import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight,
  XCircle
} from 'lucide-react';
import './App.css';

const AllergenLabelSystem = () => {
  // State management
  const [file, setFile] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // WebSocket connection with auto-reconnect
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket('ws://localhost:3001');
        
        wsRef.current.onopen = () => {
          console.log('✓ WebSocket connected');
          setWsConnected(true);
          setError('');
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'PROGRESS':
                setProgress({
                  current: data.current,
                  total: data.total,
                  message: data.message
                });
                break;
                
              case 'RECIPE_RESULT':
                setRecipes(prev => {
                  const newRecipes = [...prev];
                  newRecipes[data.index] = data.result;
                  return newRecipes;
                });
                break;
                
              case 'COMPLETE':
                setProgress({ 
                  current: data.recipes.length, 
                  total: data.recipes.length, 
                  message: 'Processing complete!' 
                });
                setProcessing(false);
                break;
                
              case 'ERROR':
                setError(data.message);
                setProcessing(false);
                break;
                
              default:
                console.warn('Unknown message type:', data.type);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setWsConnected(false);
        };
        
        wsRef.current.onclose = () => {
          console.log('✗ WebSocket disconnected');
          setWsConnected(false);
          
          // Auto-reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connectWebSocket();
          }, 3000);
        };
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
        setWsConnected(false);
      }
    };
    
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  /**
   * Parse Excel file and extract recipes
   */
  const parseExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          const parsedRecipes = [];
          let currentRecipe = null;
          
          jsonData.forEach((row, index) => {
            if (index === 0) return; // Skip header row
            
            const recipeName = row[0];
            const ingredient = row[1];
            
            if (recipeName && recipeName.toString().trim() !== '') {
              // New recipe found
              if (currentRecipe) {
                parsedRecipes.push(currentRecipe);
              }
              currentRecipe = {
                recipe_name: recipeName.toString().trim(),
                ingredients: ingredient ? [ingredient.toString().trim()] : [],
                allergens: [],
                flagged_ingredients: {},
                unrecognized_ingredients: [],
                message: 'Pending validation'
              };
            } else if (ingredient && currentRecipe) {
              // Additional ingredient for current recipe
              currentRecipe.ingredients.push(ingredient.toString().trim());
            }
          });
          
          // Add last recipe
          if (currentRecipe) {
            parsedRecipes.push(currentRecipe);
          }
          
          if (parsedRecipes.length === 0) {
            reject(new Error('No recipes found in file'));
          } else {
            resolve(parsedRecipes);
          }
        } catch (err) {
          reject(new Error(`Failed to parse Excel: ${err.message}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    
    // Validate file type
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = uploadedFile.name.substring(uploadedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setError('Please upload a valid Excel file (.xlsx or .xls)');
      return;
    }
    
    setError('');
    setFile(uploadedFile);
    setProcessing(true);
    setValidated(false);
    
    try {
      const parsedRecipes = await parseExcelFile(uploadedFile);
      setRecipes(parsedRecipes);
      setCurrentRecipeIndex(0);
      setProcessing(false);
      console.log(`Successfully parsed ${parsedRecipes.length} recipes`);
    } catch (err) {
      setError(err.message);
      setProcessing(false);
      setFile(null);
    }
  };

  /**
   * Process allergens via WebSocket
   */
  const processAllergens = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('WebSocket not connected. Please wait for connection or refresh the page.');
      return;
    }
    
    if (recipes.length === 0) {
      setError('No recipes to process');
      return;
    }
    
    setProcessing(true);
    setValidated(true);
    setError('');
    
    try {
      wsRef.current.send(JSON.stringify({
        type: 'PROCESS_RECIPES',
        recipes: recipes.map(r => ({
          recipe_name: r.recipe_name,
          ingredients: r.ingredients
        }))
      }));
    } catch (err) {
      setError('Failed to send data to server: ' + err.message);
      setProcessing(false);
    }
  };

  /**
   * Navigate to previous recipe
   */
  const goToPreviousRecipe = () => {
    setCurrentRecipeIndex(Math.max(0, currentRecipeIndex - 1));
  };

  /**
   * Navigate to next recipe
   */
  const goToNextRecipe = () => {
    setCurrentRecipeIndex(Math.min(recipes.length - 1, currentRecipeIndex + 1));
  };

  /**
   * Reset the application
   */
  const resetApp = () => {
    setFile(null);
    setRecipes([]);
    setCurrentRecipeIndex(0);
    setProcessing(false);
    setProgress({ current: 0, total: 0, message: '' });
    setError('');
    setValidated(false);
  };

  const currentRecipe = recipes[currentRecipeIndex];

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <div className="main-card">
          {/* Header */}
          <div className="header">
            <h1 className="title">🍽️ Allergen Label System</h1>
            <p className="subtitle">
              Upload recipes and identify allergens automatically
            </p>
            
            {/* WebSocket Status */}
            <div className={`ws-status ${wsConnected ? 'connected' : 'disconnected'}`}>
              <div className="status-dot"></div>
              <span>{wsConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>

          {/* File Upload Section */}
          {!validated && (
            <div className="upload-section">
              <label className="upload-area">
                <div className="upload-content">
                  <Upload className="upload-icon" />
                  <p className="upload-text">
                    <span className="upload-text-bold">Click to upload</span> or drag and drop
                  </p>
                  <p className="upload-subtext">Excel files only (.xlsx, .xls)</p>
                </div>
                <input
                  type="file"
                  className="file-input"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={processing}
                />
              </label>
              
              {file && (
                <div className="file-info">
                  <FileSpreadsheet className="file-icon" />
                  <span>{file.name}</span>
                  <button onClick={resetApp} className="reset-btn" title="Remove file">
                    <XCircle size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="alert alert-error">
              <AlertCircle className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          {/* Progress Bar */}
          {processing && progress.total > 0 && (
            <div className="progress-section">
              <div className="progress-header">
                <span className="progress-label">{progress.message}</span>
                <span className="progress-count">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Recipe Validation Table */}
          {recipes.length > 0 && !validated && (
            <div className="table-section">
              <h2 className="section-title">Validate Extracted Data</h2>
              <div className="table-container">
                <table className="recipe-table">
                  <thead>
                    <tr>
                      <th>Recipe Name</th>
                      <th>Ingredients</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipes.map((recipe, idx) => (
                      <tr key={idx}>
                        <td className="recipe-name">{recipe.recipe_name}</td>
                        <td className="ingredients-cell">
                          {recipe.ingredients.join(', ')}
                        </td>
                        <td className="count-cell">{recipe.ingredients.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <button
                onClick={processAllergens}
                disabled={processing || !wsConnected}
                className="btn-primary"
              >
                {processing ? (
                  <>
                    <Loader className="btn-icon spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="btn-icon" />
                    Process Allergens
                  </>
                )}
              </button>
              
              {!wsConnected && (
                <p className="warning-text">
                  ⚠️ Waiting for WebSocket connection...
                </p>
              )}
            </div>
          )}

          {/* Recipe Details View */}
          {validated && currentRecipe && (
            <div className="recipe-details">
              {/* Navigation Header */}
              <div className="navigation-header">
                <h2 className="section-title">Recipe Details</h2>
                <div className="navigation-controls">
                  <button
                    onClick={goToPreviousRecipe}
                    disabled={currentRecipeIndex === 0}
                    className="nav-btn"
                    title="Previous recipe"
                  >
                    <ChevronLeft />
                  </button>
                  <span className="recipe-counter">
                    {currentRecipeIndex + 1} / {recipes.length}
                  </span>
                  <button
                    onClick={goToNextRecipe}
                    disabled={currentRecipeIndex === recipes.length - 1}
                    className="nav-btn"
                    title="Next recipe"
                  >
                    <ChevronRight />
                  </button>
                </div>
              </div>

              {/* Recipe Content */}
              <div className="recipe-content">
                <h3 className="recipe-title">{currentRecipe.recipe_name}</h3>

                {/* Ingredients */}
                <div className="detail-section">
                  <h4 className="detail-title">Ingredients:</h4>
                  <ul className="ingredient-list">
                    {currentRecipe.ingredients.map((ing, idx) => (
                      <li key={idx}>{ing}</li>
                    ))}
                  </ul>
                </div>

                {/* Allergens */}
                {currentRecipe.allergens && currentRecipe.allergens.length > 0 && (
                  <div className="detail-section">
                    <h4 className="detail-title">Allergens:</h4>
                    <div className="allergen-tags">
                      {currentRecipe.allergens.map((allergen, idx) => (
                        <span key={idx} className="allergen-tag">
                          {allergen.charAt(0).toUpperCase() + allergen.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unrecognized Ingredients */}
                {currentRecipe.unrecognized_ingredients && 
                 currentRecipe.unrecognized_ingredients.length > 0 && (
                  <div className="detail-section">
                    <h4 className="detail-title">Unrecognized Ingredients:</h4>
                    <ul className="unrecognized-list">
                      {currentRecipe.unrecognized_ingredients.map((ing, idx) => (
                        <li key={idx}>{ing}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {currentRecipe.flagged_ingredients && 
                 Object.keys(currentRecipe.flagged_ingredients).length > 0 && (
                  <div className="detail-section">
                    <h4 className="detail-title">Warnings:</h4>
                    <div className="warnings-container">
                      {Object.entries(currentRecipe.flagged_ingredients).map(
                        ([ing, allergens], idx) => (
                          <div key={idx} className="warning-box">
                            <AlertCircle className="warning-icon" />
                            <p>
                              <strong>{ing}</strong> contains{' '}
                              <strong>{allergens.join(', ')}</strong>, which{' '}
                              {allergens.length === 1 ? 'is a' : 'are'} common 
                              allergen{allergens.length > 1 ? 's' : ''}.
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Status Message */}
                <div className="status-message">
                  <p>{currentRecipe.message}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="action-buttons">
                <button onClick={resetApp} className="btn-secondary">
                  Upload New File
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {recipes.length === 0 && !processing && !error && (
            <div className="empty-state">
              <FileSpreadsheet size={64} className="empty-icon" />
              <h3>No recipes uploaded</h3>
              <p>Upload an Excel file to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllergenLabelSystem;