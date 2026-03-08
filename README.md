Candidate Name: Hela Kasibhotla
Scenario Chosen: Green-Tech Inventory Assistant
Estimated Time Spent: 5-6 hours

YouTube Demo Link: https://youtu.be/4EGZo-DTNjc 

# Overview - Greenstock

An AI-powered, sustainability-focused inventory management tool for small businesses, nonprofits, university labs, and anyone else managing small scale production.

## Features

- **Full CRUD Inventory Management** — Add, edit, delete, and search items
- **Search & Filter** — Filter by name, supplier, or category
- **AI Predictive Reorder** — Claude AI forecasts when items will run out and suggests sustainable alternatives
- **Rule-Based Fallback** — When AI is unavailable, a math-based forecast kicks in automatically
- **Sustainability Score** — Dashboard showing your eco impact and CO₂ saved
- **Waste Risk Detection** — Flags items that will expire before being used
- **Input Validation** — Clear error messages for all form inputs

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Add Anthropic API key to .env
```

> **Note:** The app works without an API key — it will use rule-based forecasting as a fallback.

### 3. Run the proxy server
```bash
npm run server
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Run tests
```bash
npm test
```
## Project Structure

```
green-inventory/
├── src/
│   ├── App.jsx          # Main application component
│   ├── main.jsx         # React entry point
│   └── inventory.json   # Sample synthetic data (10 items)
├── tests/
│   └── inventory.test.js  # 11 tests (happy path + edge cases)
├── .env.example         # Environment variable template
├── .gitignore
├── index.html
├── package.json
├── server.js
└── vite.config.js
```

## Sample Data

`src/inventory.json` contains 10 synthetic inventory items across categories:
- Produce (Spinach, Avocados)
- Beverages (Arabica Coffee)
- Dairy (Oat Milk)
- Supplies (Compostable Cups, Paper Bags, Hand Sanitizer)
- Equipment (Refurbished Laptop)
- Chemicals (Ethanol)
- Donations (Blankets)

## AI Integration

The app calls the Anthropic Claude API (`claude-sonnet-4-20250514`) to generate contextual reorder forecasts. 

**Fallback behavior:** If the API key is missing or the call fails, the app automatically uses a rule-based forecast:
- 0 days → Depleted alert
- 1–3 days → Critical reorder
- 4–7 days → Low stock warning
- 8–14 days → Watch status
- 15+ days → Well stocked

## Security

- API keys are stored in `localStorage` client-side only (never hardcoded)
- `.env` is gitignored
- No backend — all data is in-memory (resets on page refresh)
- Only synthetic data is used

## Tests

11 tests across two categories:

**Happy Path (7 tests)**
- Correct days-until-empty calculation
- Green/orange/red status thresholds
- Sustainability score increases with eco-friendly items
- Score capped at 100
- Valid form passes validation

**Edge Cases (4+ tests)**  
- Zero/missing daily usage returns null
- Depleted items (0 quantity) handled correctly
- Negative/non-numeric inputs caught by validation
- Waste risk correctly penalizes sustainability score
- Score never goes below 0

## AI Disclosure:
- AI assistant was used (Claude Sonnet 4.6)
- Verfied suggestions by going line by line and checking files to see what they did as well as creating local sandbox tests. Additionally, I prompted the model, asking questions as to why it made certain decisions for speciic implementations.
- An example of a changed or rejected suggestion was implementing the AI forecasting feature without a proxy server. I personally have always integreated LLM models through the use of a proxy server and decided to add this file and functioality to the code.


## Tradeoffs & Prioritization:
- To stay within the time limit, I decided to make this web app exclusively with React and no backend. I felt asthough this would maximize my time working on functionality as opposed to creating a database management system (since all of the data is synthesized).
- If given more time, I would flesh out a robust backend that would facilitate memory and data management more efficiently. I would also integrate auth so that users could create a profile in which they could customize their dashboard in a manner they'd perfer. Finally, as opposed to having users input an LLM API key for Ai forecasting, the backend would also query the LLM for each item and its corresponding forecast.
- Known limitations:
    - No user auth
    - User inputted LLM API key 
    - No backend (i.e. no database, no data management etc.)
    - Lack of robust data
