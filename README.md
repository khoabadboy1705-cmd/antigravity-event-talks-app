# BigQuery Release Hub

A premium, responsive, and real-time dashboard to monitor, search, and share Google BigQuery release notes and updates.

This project aggregates the official Google BigQuery XML RSS/Atom feed, parses individual updates by category (Features, Changes, Issues, Deprecations), and displays them in a sleek, glassmorphic layout. It also includes an integrated X/Twitter draft composer with standard character-limit validation for easy social sharing.

---

## Key Features

* **Automated Aggregation & Parsing**: Automatically fetches the official Google BigQuery release notes feed and uses `BeautifulSoup` to split daily entries into individual, categorized cards (e.g., Features, Changes, Issues, Deprecated).
* **Smart Server Caching**: Utilizes a 15-minute backend in-memory cache to prevent redundant API queries to Google and guarantee instant dashboard load times.
* **Network Fault Resilience**: Automatically falls back to the last successfully cached data if the upstream Google feed is offline or unreachable.
* **Instant Client-Side Filtering**: Perform instant keyword search and category tag filtering entirely on the client, avoiding server round-trips.
* **X/Twitter Composer Modal**: Draft and format post updates directly from the card. Features a visual SVG progress ring to track character count limits (with Twitter-accurate URL length calculations of 23 characters).
* **Premium Dark Theme**: Features ambient background glow effects, loading skeleton views, glassmorphic containers, smooth micro-interactions, and toast alerts.

---

## Tech Stack

* **Backend**: Python 3, Flask, BeautifulSoup4 (`bs4`)
* **Frontend**: Vanilla HTML5, Custom CSS3, Vanilla ES6 JavaScript

---

## Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/khoabadboy1705-cmd/antigravity-event-talks-app.git
   cd antigravity-event-talks-app
   ```

2. **Install Dependencies**:
   Ensure you have Python installed, then install Flask and BeautifulSoup4:
   ```bash
   pip install flask beautifulsoup4
   ```

3. **Run the Application**:
   ```bash
   python app.py
   ```

4. **Access the Dashboard**:
   Open your browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```

---

## Project Structure

```text
antigravity-event-talks-app/
├── app.py                # Main Flask application (Server routes, parsing, caching)
├── templates/
│   └── index.html        # Main dashboard page framework and modals
└── static/
    ├── css/
    │   └── style.css     # UI design guidelines, animations, typography
    └── js/
        └── app.js        # UI event handlers, client-side search/filters, Twitter logic
```

---

## License

Distributed under the MIT License. See `LICENSE` for more information (if applicable).
