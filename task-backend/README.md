# Allergen Label System - Backend

Backend server for the Allergen Label System with real-time WebSocket support and REST API.

## 🚀 Quick Start

### Installation
```bash
# Install dependencies
npm install

# Start development server (with auto-reload)
npm run dev

# Start production server
npm start
```

The server will start on `http://localhost:3001`

## 📡 API Endpoints

### 1. Health Check
```
GET /api/health
```
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T10:30:00.000Z",
  "service": "Allergen Label System"
}
```

### 2. Upload Excel File
```
POST /api/upload
Content-Type: multipart/form-data
```
**Request:**
- Form field: `file` (Excel file)

**Response:**
```json
{
  "success": true,
  "recipes": [...],
  "count": 5,
  "message": "Successfully parsed 5 recipe(s)"
}
```

### 3. Process Recipes
```
POST /api/process
Content-Type: application/json
```
**Request:**
```json
{
  "recipes": [
    {
      "recipe_name": "Margherita Pizza",
      "ingredients": ["Dough", "Tomato Sauce", "Mozzarella"]
    }
  ]
}
```

**Response:**
```json
{
  "recipes": [
    {
      "recipe_name": "Margherita Pizza",
      "allergens": ["gluten", "milk"],
      "flagged_ingredients": {
        "Dough": ["gluten"],
        "Mozzarella": ["milk"]
      },
      "unrecognized_ingredients": ["Tomato Sauce"],
      "message": "Some ingredients were not recognized."
    }
  ]
}
```

### 4. Check Single Ingredient
```
GET /api/allergen/:ingredient
```
**Example:** `GET /api/allergen/mozzarella`

**Response:**
```json
{
  "ingredient": "mozzarella",
  "allergens": ["milk"],
  "found": true
}
```

### 5. List All Allergens
```
GET /api/allergens/list
```
**Response:**
```json
{
  "allergens": ["egg", "fish", "gluten", "milk", ...],
  "count": 10
}
```

## ⚡ WebSocket

Connect to `ws://localhost:3001` for real-time processing updates.

### Message Format

**Client → Server:**
```json
{
  "type": "PROCESS_RECIPES",
  "recipes": [...]
}
```

**Server → Client (Progress):**
```json
{
  "type": "PROGRESS",
  "current": 3,
  "total": 10,
  "message": "Processing Margherita Pizza..."
}
```

**Server → Client (Result):**
```json
{
  "type": "RECIPE_RESULT",
  "index": 2,
  "result": {...}
}
```

**Server → Client (Complete):**
```json
{
  "type": "COMPLETE",
  "recipes": [...]
}
```

## 🏗️ Architecture

### Hybrid Allergen Detection
1. **Local Database** - Fast lookup for common ingredients
2. **Open Food Facts API** - Fallback for unknown ingredients
3. **Error Resilience** - Continues processing even if API fails

### Why WebSocket?
- Real-time progress updates
- Better user experience for large files
- No polling overhead
- Efficient for multiple recipes

## 🧪 Testing

### Using cURL

**Health Check:**
```bash
curl http://localhost:3001/api/health
```

**Upload File:**
```bash
curl -X POST http://localhost:3001/api/upload \
  -F "file=@recipes.xlsx"
```

**Process Recipes:**
```bash
curl -X POST http://localhost:3001/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "recipes": [{
      "recipe_name": "Test",
      "ingredients": ["flour", "milk"]
    }]
  }'
```

## 📊 Performance

- Processes ~10 recipes/second with local database
- API fallback adds ~500ms per ingredient
- Memory efficient (< 50MB for 100 recipes)

## 🔧 Configuration

Edit `server.js` to customize:
- `PORT` - Server port (default: 3001)
- `ALLERGEN_DATABASE` - Add more allergens
- Upload limits - Modify `multer` config

## 🐛 Troubleshooting

**Port already in use:**
```bash
# Find process
lsof -ti:3001

# Kill process
kill -9 <PID>
```

**Module not found:**
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📝 License

ISC



