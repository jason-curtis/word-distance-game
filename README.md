# Word Distance Game

A semantic word guessing game powered by GloVe embeddings. Players try to guess target words using semantic similarity feedback.

## Prerequisites

This project uses two package managers:

- **[uv](https://docs.astral.sh/uv/)** - Fast Python package manager
- **[pnpm](https://pnpm.io/)** - Fast, disk space efficient Node.js package manager

### Installing Package Managers

#### Install uv (Python)

**macOS/Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows:**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**With pip:**
```bash
pip install uv
```

#### Install pnpm (Node.js)

**macOS/Linux:**
```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

**Windows:**
```powershell
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

**With npm:**
```bash
npm install -g pnpm
```

## Setup

### 1. Install Python Dependencies

```bash
uv sync
```

This will create a virtual environment and install all Python dependencies (nltk, tqdm).

### 2. Install Node.js Dependencies

```bash
pnpm install
```

### 3. Prepare Word Embeddings

Download and process GloVe embeddings to create the word list:

```bash
uv run prepare-words
```

Or alternatively:

```bash
pnpm run prepare-words
```

This downloads the GloVe 2024 Wikipedia embeddings, filters words using an English dictionary, and creates a curated word list with semantic similarity data.

**Note:** The first run will download ~70MB of GloVe data and may take several minutes.

## Development

### Run Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
pnpm build
```

### Preview Production Build

```bash
pnpm preview
```

## Testing

### Run All Tests

```bash
pnpm test
```

### Run Tests with UI

```bash
pnpm test:ui
```

### Run Tests in Headed Mode

```bash
pnpm test:headed
```

### Verify Game Logic

```bash
pnpm test:verify
```

## Project Structure

```
word-distance-game/
├── scripts/
│   └── prepare_words.py      # GloVe embeddings processor
├── src/
│   ├── components/           # React components
│   ├── data/                 # Generated word embeddings data
│   ├── hooks/                # React hooks
│   ├── types/                # TypeScript types
│   └── utils/                # Utility functions
├── tests/                    # Playwright tests
├── pyproject.toml            # Python dependencies (uv)
├── package.json              # Node.js dependencies (pnpm)
└── pnpm-lock.yaml           # pnpm lockfile
```

## How It Works

1. **Word Embeddings**: Uses GloVe (Global Vectors for Word Representation) to represent words as 50-dimensional vectors
2. **Semantic Similarity**: Measures how close two words are in meaning using cosine similarity
3. **Dictionary Validation**: Filters words through NLTK's English dictionary to ensure quality
4. **Variant Mapping**: Maps word variants (e.g., "running" → "run") for better gameplay

## Technologies

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS
- **Visualization**: D3.js
- **Testing**: Playwright
- **Python**: NLTK, tqdm
- **Embeddings**: GloVe 2024 Wikipedia (50d)

## License

MIT
