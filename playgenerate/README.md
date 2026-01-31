# PlayGenerate

NFL play video generator pipeline. Enriches Big Data Bowl tracking data with ESPN metadata and generates video clips.

## Setup

```bash
cd playgenerate
pip install -r requirements.txt
```

Create a `.env` file in the repo root with your API keys:

```
GOOGLE_API_KEY=your_gemini_api_key
```

## CLI Commands

Run the pipeline from the `playgenerate/src` directory:

```bash
cd playgenerate/src
```

**Enrich plays only:**

```bash
python pipeline.py --week 1 --max-plays 10
```

**Generate scene descriptions from existing enriched data:**

```bash
python pipeline.py --week 1 --scenes-only --max-plays 5
```

**Full pipeline (enrich + scenes + video):**

```bash
python pipeline.py --week 1 --full --max-plays 5
```

**Skip video generation:**

```bash
python pipeline.py --week 1 --full --no-video --max-plays 5
```

### CLI Options

- `--week` - Week number to process (default: 1)
- `--max-plays` - Limit number of plays (default: 5)
- `--data-dir` - Input data directory
- `--output-dir` - Output directory

## Web UI

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000

## Project Structure

```
playgenerate/
├── data/              # Input data (Big Data Bowl CSVs)
├── output/            # Generated outputs
│   ├── enriched/      # Enriched play CSVs
│   └── videos/        # Generated video files
└── src/
    ├── enrichment/    # ESPN API integration
    ├── generation/    # Scene & video generation
    └── pipeline.py    # Main entry point
```
