// server.js (ES Module)

import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import multer from 'multer';
import xlsx from 'xlsx';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Allergen database (fallback)
const ALLERGEN_DATABASE = {
  dough: ['gluten'], wheat: ['gluten'], flour: ['gluten'],
  bread: ['gluten'], croutons: ['gluten'], pasta: ['gluten'],
  barley: ['gluten'], rye: ['gluten'], oats: ['gluten'],

  cheese: ['milk'], mozzarella: ['milk'], cheddar: ['milk'],
  parmesan: ['milk'], milk: ['milk'], butter: ['milk'],
  cream: ['milk'], yogurt: ['milk'], whey: ['milk'],

  egg: ['egg'], eggs: ['egg'], mayonnaise: ['egg'],

  fish: ['fish'], salmon: ['fish'], tuna: ['fish'],
  anchovies: ['fish'], cod: ['fish'], sardines: ['fish'],

  shrimp: ['shellfish'], crab: ['shellfish'], lobster: ['shellfish'],
  prawns: ['shellfish'], oyster: ['shellfish'],

  peanut: ['peanuts'], peanuts: ['peanuts'],

  almond: ['tree nuts'], walnut: ['tree nuts'], cashew: ['tree nuts'],
  pistachio: ['tree nuts'], pecan: ['tree nuts'],

  soy: ['soy'], tofu: ['soy'], 'soy sauce': ['soy'], edamame: ['soy'],

  sesame: ['sesame'], tahini: ['sesame']
};

// Parse Excel file
function parseExcelFile(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  const recipes = [];
  let currentRecipe = null;

  rows.forEach((row, index) => {
    if (index === 0) return;

    const recipeName = row[0];
    const ingredient = row[1];

    if (recipeName?.toString().trim()) {
      if (currentRecipe) recipes.push(currentRecipe);

      currentRecipe = {
        recipe_name: recipeName.toString().trim(),
        ingredients: ingredient ? [ingredient.toString().trim()] : []
      };
    } else if (ingredient && currentRecipe) {
      currentRecipe.ingredients.push(ingredient.toString().trim());
    }
  });

  if (currentRecipe) recipes.push(currentRecipe);
  return recipes;
}

// OpenFoodFacts API
async function fetchFromOpenFoodFacts(ingredient) {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      ingredient
    )}&search_simple=1&action=process&json=1`;

    const { data } = await axios.get(url, { timeout: 5000 });

    if (data.products?.length) {
      return (
        data.products[0].allergens_tags?.map(tag =>
          tag.replace('en:', '').replace(/-/g, ' ')
        ) || null
      );
    }
    return null;
  } catch {
    return null;
  }
}

// Detect allergens
async function detectAllergens(ingredient) {
  const lower = ingredient.toLowerCase();
  const found = [];

  for (const key in ALLERGEN_DATABASE) {
    if (lower.includes(key)) {
      found.push(...ALLERGEN_DATABASE[key]);
    }
  }

  if (found.length) return [...new Set(found)];
  return (await fetchFromOpenFoodFacts(ingredient)) || [];
}

// Process recipe
async function processRecipe(recipe) {
  const allergens = new Set();
  const flagged = {};
  const unrecognized = [];

  for (const ingredient of recipe.ingredients) {
    const detected = await detectAllergens(ingredient);

    if (detected.length) {
      detected.forEach(a => allergens.add(a));
      flagged[ingredient] = detected;
    } else {
      unrecognized.push(ingredient);
    }
  }

  return {
    recipe_name: recipe.recipe_name,
    allergens: [...allergens],
    flagged_ingredients: flagged,
    unrecognized_ingredients: unrecognized,
    message: unrecognized.length
      ? 'Some ingredients were not recognized.'
      : 'Processed successfully.'
  };
}

// WebSocket
wss.on('connection', ws => {
  ws.on('message', async msg => {
    const data = JSON.parse(msg);

    if (data.type === 'PROCESS_RECIPES') {
      const results = [];

      for (let i = 0; i < data.recipes.length; i++) {
        ws.send(JSON.stringify({
          type: 'PROGRESS',
          current: i + 1,
          total: data.recipes.length
        }));

        const result = await processRecipe(data.recipes[i]);
        results.push(result);

        ws.send(JSON.stringify({
          type: 'RECIPE_RESULT',
          index: i,
          result
        }));
      }

      ws.send(JSON.stringify({ type: 'COMPLETE', recipes: results }));
    }
  });
});

// REST APIs
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const recipes = parseExcelFile(req.file.buffer);
  res.json({ success: true, recipes });
});

app.post('/api/process', async (req, res) => {
  const results = await Promise.all(
    req.body.recipes.map(processRecipe)
  );
  res.json({ recipes: results });
});

app.get('/api/allergen/:ingredient', async (req, res) => {
  const allergens = await detectAllergens(req.params.ingredient);
  res.json({ allergens });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server };
