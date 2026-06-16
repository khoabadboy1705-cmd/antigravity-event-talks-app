import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup
import time
import re

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for release notes
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION_SEC = 900  # 15 minutes

def parse_release_notes(xml_data):
    root = ET.fromstring(xml_data)
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = []
    
    for entry_el in root.findall('atom:entry', namespaces):
        title = entry_el.find('atom:title', namespaces).text
        updated = entry_el.find('atom:updated', namespaces).text
        entry_id = entry_el.find('atom:id', namespaces).text
        content_el = entry_el.find('atom:content', namespaces)
        
        content_html = content_el.text if content_el is not None else ""
        
        # Parse content html with BeautifulSoup to extract individual updates
        soup = BeautifulSoup(content_html, 'html.parser')
        
        items = []
        current_type = None
        current_html_parts = []
        
        # Iterate over child nodes in the parsed document to group updates by heading
        for element in soup.contents:
            # Check if this element is an h3 tag
            if getattr(element, 'name', None) == 'h3':
                # If we were already building an item, save it first
                if current_type and current_html_parts:
                    items.append({
                        'type': current_type,
                        'html_content': "".join(str(x) for x in current_html_parts).strip(),
                        'text_content': BeautifulSoup("".join(str(x) for x in current_html_parts), 'html.parser').get_text(separator=" ").strip()
                    })
                current_type = element.get_text().strip()
                current_html_parts = []
            else:
                if current_type is not None:
                    current_html_parts.append(element)
                elif str(element).strip():
                    # Ignored text before the first heading
                    pass
        
        # Add the final item
        if current_type and current_html_parts:
            items.append({
                'type': current_type,
                'html_content': "".join(str(x) for x in current_html_parts).strip(),
                'text_content': BeautifulSoup("".join(str(x) for x in current_html_parts), 'html.parser').get_text(separator=" ").strip()
            })
            
        # Fallback: if no headings were found, treat the entire body as a single update
        if not items and content_html:
            items.append({
                'type': 'Update',
                'html_content': content_html,
                'text_content': soup.get_text(separator=" ").strip()
            })
            
        entries.append({
            'id': entry_id,
            'date': title,  # Date title (e.g. "June 15, 2026")
            'updated': updated,
            'items': items
        })
        
    return entries

def fetch_feed(force=False):
    now = time.time()
    # Return cache if valid and not forcing refresh
    if not force and cache["data"] is not None and (now - cache["last_fetched"] < CACHE_DURATION_SEC):
        return cache["data"], "cached"
        
    try:
        # Set a user-agent to resemble a standard browser fetch
        req = urllib.request.Request(
            FEED_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BigQueryReleaseNotesFetcher/1.0'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
            
        parsed_data = parse_release_notes(xml_data)
        cache["data"] = parsed_data
        cache["last_fetched"] = now
        return parsed_data, "live"
    except Exception as e:
        # If live fetch fails but we have cached data, return cache as fallback
        if cache["data"] is not None:
            return cache["data"], "fallback"
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data, source = fetch_feed(force=force_refresh)
        return jsonify({
            "status": "success",
            "source": source,
            "timestamp": cache["last_fetched"],
            "releases": data
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
