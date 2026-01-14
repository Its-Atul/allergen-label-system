# Allergen Label System - Frontend

React-based frontend application for the Allergen Label System with real-time WebSocket updates.

## 🚀 Quick Start

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm start
```

The app will open at `http://localhost:3000`

## 🎨 Features

- **Drag & Drop File Upload** - Upload Excel files easily
- **Real-time Progress** - WebSocket updates during processing
- **Interactive Navigation** - Browse through recipes
- **Allergen Visualization** - Color-coded tags and warnings
- **Responsive Design** - Works on all devices
- **Error Handling** - Clear error messages and recovery

## 📱 Usage

1. **Upload Excel File**
   - Click upload area or drag & drop
   - File must be .xlsx or .xls format

2. **Validate Data**
   - Review extracted recipes in table
   - Check ingredient counts

3. **Process Allergens**
   - Click "Process Allergens" button
   - Watch real-time progress

4. **View Results**
   - Navigate between recipes
   - See allergens, warnings, and unrecognized ingredients

## 🏗️ Project Structure
```
src/
├── App.js          # Main application component
├── App.css         # Application styles
├── index.js        # React entry point
└── index.css       # Global styles
```

## 🔌 WebSocket Integration

The app connects to `ws://localhost:3001` for real-time updates.

### Connection States
- **Connected** - Green indicator
- **Disconnected** - Red indicator (auto-reconnects)

### Message Types
- `PROGRESS` - Processing progress updates
- `RECIPE_RESULT` - Individual recipe results
- `COMPLETE` - Processing complete
- `ERROR` - Error notifications

## 🎨 Styling

- Custom CSS with no external frameworks
- Responsive design breakpoints
- Smooth animations and transitions
- Accessible color contrast

## 🧪 Building for Production
```bash
npm run build
```

Creates optimized production build in `build/` folder.

## 🔧 Configuration

### Change Backend URL

Edit WebSocket connection in `App.js`:
```javascript
wsRef.current = new WebSocket('ws://your-backend-url');
```

### Customize Colors

Edit variables in `App.css` to match your brand.

## 📝 License

ISC