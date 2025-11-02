import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Importar las imágenes
import mesaImg from './images/mesa.png';
import pataImg from './images/pata.png';
import limonImg from './images/limon.png';
import azucarImg from './images/azucar.png';
import hieloImg from './images/hielo.png';
import vasoImg from './images/vaso.png';

interface StandPiece {
  id: string;
  type: 'mesa' | 'pata' | 'limon' | 'azucar' | 'hielo' | 'vaso';
  image: string;
  name: string;
  quantity: number;
}

interface PlacedPiece {
  id: string;
  type: string;
  x: number;
  y: number;
  image: string;
  name: string;
}

interface DragDropStandProps {
  onStandComplete: (isComplete: boolean) => void;
  onRecipeChange: (recipe: { lemons: number; sugar: number; ice: number; cups: number }) => void;
}

export const DragDropStand: React.FC<DragDropStandProps> = ({ onStandComplete, onRecipeChange }) => {
  const [draggedItem, setDraggedItem] = useState<StandPiece | null>(null);
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([]);
  const [recipe, setRecipe] = useState({ lemons: 0, sugar: 0, ice: 0, cups: 0 });
  const [isStandComplete, setIsStandComplete] = useState(false);
  const [showPiecesPanel, setShowPiecesPanel] = useState(true);
  const [draggedPlacedPiece, setDraggedPlacedPiece] = useState<PlacedPiece | null>(null);
  
  const standAreaRef = useRef<HTMLDivElement>(null);
  const recipeAreaRef = useRef<HTMLDivElement>(null);

  // Piezas disponibles para el stand
  const standPieces: StandPiece[] = [
    { id: 'mesa-1', type: 'mesa', image: mesaImg, name: 'Mesa', quantity: 1 },
    { id: 'pata-1', type: 'pata', image: pataImg, name: 'Pata', quantity: 4 },
  ];

  // Ingredientes para la receta
  const recipeIngredients: StandPiece[] = [
    { id: 'limon-recipe', type: 'limon', image: limonImg, name: 'Limón', quantity: 0 },
    { id: 'azucar-recipe', type: 'azucar', image: azucarImg, name: 'Azúcar', quantity: 0 },
    { id: 'hielo-recipe', type: 'hielo', image: hieloImg, name: 'Hielo', quantity: 0 },
    { id: 'vaso-recipe', type: 'vaso', image: vasoImg, name: 'Vaso', quantity: 0 },
  ];

  const handleDragStart = (e: React.DragEvent, piece: StandPiece) => {
    setDraggedItem(piece);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePlacedPieceDragStart = (e: React.DragEvent, piece: PlacedPiece) => {
    setDraggedPlacedPiece(piece);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetArea: 'stand' | 'recipe') => {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Si se está moviendo una pieza ya colocada
    if (draggedPlacedPiece) {
      setPlacedPieces(prev => 
        prev.map(piece => 
          piece.id === draggedPlacedPiece.id 
            ? { ...piece, x, y }
            : piece
        )
      );
      setDraggedPlacedPiece(null);
      return;
    }

    // Si se está arrastrando una nueva pieza
    if (!draggedItem) return;

    if (targetArea === 'stand') {
      // Verificar si es una pieza del stand
      if (draggedItem.type === 'mesa' || draggedItem.type === 'pata') {
        const newPiece: PlacedPiece = {
          id: `${draggedItem.type}-${Date.now()}`,
          type: draggedItem.type,
          x,
          y,
          image: draggedItem.image,
          name: draggedItem.name
        };

        setPlacedPieces(prev => {
          const newPieces = [...prev, newPiece];
          
          // Verificar si el stand está completo
          const mesaCount = newPieces.filter(p => p.type === 'mesa').length;
          const pataCount = newPieces.filter(p => p.type === 'pata').length;
          
          if (mesaCount >= 1 && pataCount >= 4) {
            setIsStandComplete(true);
            onStandComplete(true);
            setShowPiecesPanel(false);
          }
          
          return newPieces;
        });
      }
    } else if (targetArea === 'recipe') {
      // Verificar si es un ingrediente para la receta
      if (['limon', 'azucar', 'hielo', 'vaso'].includes(draggedItem.type)) {
        const newRecipe = {
          ...recipe,
          [draggedItem.type === 'limon' ? 'lemons' : 
           draggedItem.type === 'azucar' ? 'sugar' :
           draggedItem.type === 'hielo' ? 'ice' : 'cups']: 
          recipe[draggedItem.type === 'limon' ? 'lemons' : 
                 draggedItem.type === 'azucar' ? 'sugar' :
                 draggedItem.type === 'hielo' ? 'ice' : 'cups'] + 1
        };
        
        setRecipe(newRecipe);
        onRecipeChange(newRecipe);
      }
    }

    setDraggedItem(null);
  };

  const resetStand = () => {
    setPlacedPieces([]);
    setIsStandComplete(false);
    setShowPiecesPanel(true);
    onStandComplete(false);
  };

  const resetRecipe = () => {
    setRecipe({ lemons: 0, sugar: 0, ice: 0, cups: 0 });
    onRecipeChange({ lemons: 0, sugar: 0, ice: 0, cups: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Panel de piezas del stand */}
      {showPiecesPanel && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">🏗️ Construye tu Stand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {standPieces.map((piece) => (
                <div
                  key={piece.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, piece)}
                  className="bg-white p-4 rounded-lg border-2 border-dashed border-blue-300 cursor-move hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <img 
                    src={piece.image} 
                    alt={piece.name}
                    className="w-16 h-16 mx-auto mb-2 object-contain"
                  />
                  <p className="text-center text-sm font-medium text-blue-700">
                    {piece.name}
                  </p>
                  <p className="text-center text-xs text-gray-500">
                    x{piece.quantity}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-blue-600 mt-4 text-center">
              Arrastra las piezas al área del stand para construir tu mesa
            </p>
          </CardContent>
        </Card>
      )}

      {/* Área de construcción del stand */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-800 flex justify-between items-center">
            <span>🏪 Área del Stand</span>
            {isStandComplete && (
              <Button onClick={resetStand} variant="outline" size="sm">
                🔄 Reconstruir
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={standAreaRef}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'stand')}
            className="relative bg-gradient-to-b from-sky-200 to-green-200 h-128 rounded-lg border-2 border-dashed border-green-300 min-h-[400px]"
          >
            {placedPieces.map((piece) => (
              <div
                key={piece.id}
                draggable
                onDragStart={(e) => handlePlacedPieceDragStart(e, piece)}
                className="absolute cursor-move hover:scale-110 transition-transform duration-200"
                style={{
                  left: `${piece.x}px`,
                  top: `${piece.y}px`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <img 
                  src={piece.image} 
                  alt={piece.name}
                  className={`object-contain drop-shadow-lg ${
                    piece.type === 'mesa' 
                      ? 'w-48 h-48' 
                      : 'w-12 h-12'
                  }`}
                />
              </div>
            ))}
            
            {isStandComplete && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-green-500 text-white px-6 py-3 rounded-full font-bold text-lg shadow-lg animate-bounce">
                  🎉 ¡Stand Completado! 🎉
                </div>
              </div>
            )}
            
            {!isStandComplete && (
              <>
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                  <p className="text-gray-500 text-lg bg-white/80 px-4 py-2 rounded-lg shadow-sm">
                    Arrastra aquí las piezas para construir tu stand
                  </p>
                </div>
                <div className="absolute top-4 right-4 bg-white/90 p-3 rounded-lg shadow-lg">
                  <div className="text-sm text-gray-600 mb-2 font-semibold">Progreso:</div>
                  <div className="space-y-2 text-xs">
                    <div className={`px-2 py-1 rounded flex items-center justify-between ${placedPieces.filter(p => p.type === 'mesa').length >= 1 ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      <span>Mesa:</span>
                      <span className="font-bold">{placedPieces.filter(p => p.type === 'mesa').length}/1</span>
                    </div>
                    <div className={`px-2 py-1 rounded flex items-center justify-between ${placedPieces.filter(p => p.type === 'pata').length >= 4 ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      <span>Patas:</span>
                      <span className="font-bold">{placedPieces.filter(p => p.type === 'pata').length}/4</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Área de receta */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-yellow-800 flex justify-between items-center">
            <span>👨‍🍳 Crea tu Receta</span>
            <Button onClick={resetRecipe} variant="outline" size="sm">
              🔄 Limpiar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {recipeIngredients.map((ingredient) => (
              <div
                key={ingredient.id}
                draggable
                onDragStart={(e) => handleDragStart(e, ingredient)}
                className="bg-white p-3 rounded-lg border-2 border-dashed border-yellow-300 cursor-move hover:border-yellow-500 hover:bg-yellow-50 transition-all"
              >
                <img 
                  src={ingredient.image} 
                  alt={ingredient.name}
                  className="w-12 h-12 mx-auto mb-2 object-contain"
                />
                <p className="text-center text-sm font-medium text-yellow-700">
                  {ingredient.name}
                </p>
              </div>
            ))}
          </div>
          
          <div
            ref={recipeAreaRef}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'recipe')}
            className="bg-white p-6 rounded-lg border-2 border-dashed border-yellow-300 min-h-[120px]"
          >
            <h4 className="text-lg font-semibold text-yellow-800 mb-4 text-center">
              Tu Receta Actual:
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <span className="text-2xl">🍋</span>
                <p className="font-bold text-lg">{recipe.lemons}</p>
                <p className="text-sm text-gray-600">Limones</p>
              </div>
              <div className="text-center">
                <span className="text-2xl">🍯</span>
                <p className="font-bold text-lg">{recipe.sugar}</p>
                <p className="text-sm text-gray-600">Azúcar</p>
              </div>
              <div className="text-center">
                <span className="text-2xl">🧊</span>
                <p className="font-bold text-lg">{recipe.ice}</p>
                <p className="text-sm text-gray-600">Hielo</p>
              </div>
              <div className="text-center">
                <span className="text-2xl">🥤</span>
                <p className="font-bold text-lg">{recipe.cups}</p>
                <p className="text-sm text-gray-600">Vasos</p>
              </div>
            </div>
            <p className="text-sm text-yellow-600 mt-4 text-center">
              Arrastra los ingredientes aquí para crear tu receta
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
