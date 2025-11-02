# ✅ Sistema de Lecciones Automáticas por Edad

## Descripción

Las lecciones en la sección "Lecciones V.2" ahora se seleccionan **automáticamente** según la edad del child, calculada desde su fecha de nacimiento.

---

## 🎯 Reglas de Asignación

El sistema calcula la edad del niño y asigna el rango de lecciones apropiado:

| Edad del Child | Rango Asignado | Contenido |
|----------------|----------------|-----------|
| **0-10 años** | 8-10 años | Exploradores Financieros - Conceptos básicos |
| **11-13 años** | 11-13 años | Administradores Junior - Conceptos intermedios |
| **14+ años** | 14-16 años | Financieros Avanzados - Conceptos avanzados |

---

## 🔧 Implementación

### Cambios en `src/pages/LeccionesV2.tsx`

#### 1. **Importación de useEffect**
```typescript
import { useState, useEffect } from "react";
```

#### 2. **Nuevos Estados**
```typescript
const [userAge, setUserAge] = useState<number | null>(null);
const [isLoading, setIsLoading] = useState(true);
```

#### 3. **Cálculo Automático de Edad**
```typescript
useEffect(() => {
  const calculateAge = () => {
    // 1. Obtener usuario del localStorage
    const userStr = localStorage.getItem('user');
    const user = JSON.parse(userStr);
    
    // 2. Verificar fecha de nacimiento
    if (!user.birth_date) {
      console.warn('User does not have birth_date');
      return;
    }
    
    // 3. Calcular edad exacta
    const birthDate = new Date(user.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Ajustar si aún no ha cumplido años este año
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    setUserAge(age);
    
    // 4. Determinar rango automáticamente
    let ageRange = "8-10";
    if (age >= 0 && age <= 10) {
      ageRange = "8-10";
    } else if (age >= 11 && age <= 13) {
      ageRange = "11-13";
    } else if (age >= 14) {
      ageRange = "14-16";
    }
    
    setSelectedAgeRange(ageRange);
    console.log(`✅ Edad calculada: ${age} años → Rango: ${ageRange}`);
  };
  
  calculateAge();
}, []);
```

#### 4. **Selector Manual Reemplazado**

**ANTES (❌ Selector Manual):**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Selecciona tu Rango de Edad</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {ageRanges.map((range) => (
        <Card onClick={() => setSelectedAgeRange(range.id)}>
          {/* Selector clickeable */}
        </Card>
      ))}
    </div>
  </CardContent>
</Card>
```

**AHORA (✅ Información Automática):**
```typescript
<Card className="bg-gradient-to-r from-blue-50 to-purple-50">
  <CardHeader>
    <CardTitle>Tu Nivel de Lecciones</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Muestra la edad calculada y el rango asignado */}
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">Tu edad</p>
        <p className="text-2xl font-bold">{userAge} años</p>
      </div>
      <Badge>{selectedAgeRange}</Badge>
    </div>
    <p className="text-sm text-gray-600">
      Las lecciones se han seleccionado automáticamente según tu edad
    </p>
  </CardContent>
</Card>
```

#### 5. **Indicador de Carga**
```typescript
{isLoading ? (
  <Card>
    <CardContent className="text-center py-12">
      <RefreshCw className="animate-spin" />
      <p>Preparando tus lecciones...</p>
    </CardContent>
  </Card>
) : (
  // Mostrar lecciones
)}
```

---

## 🎓 Ejemplos

### Ejemplo 1: Child de 9 años
```
Fecha de nacimiento: 2015-03-15
Fecha actual: 2025-10-08
Edad calculada: 9 años

✅ Rango asignado: 8-10 años
✅ Lecciones mostradas: Exploradores Financieros
```

### Ejemplo 2: Child de 12 años
```
Fecha de nacimiento: 2013-06-20
Fecha actual: 2025-10-08
Edad calculada: 12 años

✅ Rango asignado: 11-13 años
✅ Lecciones mostradas: Administradores Junior
```

### Ejemplo 3: Child de 15 años
```
Fecha de nacimiento: 2010-01-10
Fecha actual: 2025-10-08
Edad calculada: 15 años

✅ Rango asignado: 14-16 años
✅ Lecciones mostradas: Financieros Avanzados
```

---

## 📊 Flujo del Sistema

```
1. Child entra a Lecciones V.2
   ↓
2. useEffect se ejecuta al montar el componente
   ↓
3. Se obtiene usuario del localStorage
   ↓
4. Se extrae birth_date del usuario
   ↓
5. Se calcula edad exacta (años completos)
   ↓
6. Se determina rango de edad según reglas
   ↓
7. Se setea selectedAgeRange automáticamente
   ↓
8. Se muestran las lecciones del rango apropiado
```

---

## 🔍 Cálculo de Edad

### Fórmula Implementada:

```typescript
const birthDate = new Date(user.birth_date);
const today = new Date();

// Diferencia de años
let age = today.getFullYear() - birthDate.getFullYear();

// Ajuste si aún no ha cumplido años este año
const monthDiff = today.getMonth() - birthDate.getMonth();
if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
  age--;
}
```

### Ejemplo de Cálculo:

```
Fecha de nacimiento: 2015-11-20
Fecha actual: 2025-10-08

Diferencia de años: 2025 - 2015 = 10
Mes actual: octubre (10)
Mes de nacimiento: noviembre (11)
monthDiff = 10 - 11 = -1

Como monthDiff < 0, aún no ha cumplido años
Edad final: 10 - 1 = 9 años ✅
```

---

## 🎨 Interfaz de Usuario

### Antes:
- Selector manual con 3 tarjetas clickeables
- Usuario tenía que seleccionar manualmente su edad
- Posibilidad de seleccionar edad incorrecta

### Ahora:
- **Tarjeta informativa** que muestra:
  - Edad calculada automáticamente
  - Rango de edad asignado
  - Descripción del nivel
  - Mensaje explicativo
- No requiere interacción del usuario
- Siempre muestra el contenido apropiado

---

## ⚙️ Configuración de Rangos

Los rangos están definidos en el código:

```typescript
// 0-10 años → "8-10"
if (age >= 0 && age <= 10) {
  ageRange = "8-10";
}

// 11-13 años → "11-13"
else if (age >= 11 && age <= 13) {
  ageRange = "11-13";
}

// 14+ años → "14-16"
else if (age >= 14) {
  ageRange = "14-16";
}
```

---

## ✅ Ventajas

1. **Precisión:** Siempre muestra contenido apropiado para la edad
2. **Automatización:** No requiere intervención manual
3. **UX Mejorada:** Menos clicks, experiencia más fluida
4. **Prevención de Errores:** Imposible seleccionar edad incorrecta
5. **Actualización Automática:** La edad se recalcula cada vez que se carga la página

---

## 🧪 Cómo Probar

### 1. Registrar un Child con Fecha de Nacimiento

```bash
# Registrar familia con child de 9 años
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tutor": {
      "name": "Juan Pérez",
      "email": "juan@test.com",
      "password": "test123"
    },
    "child": {
      "name": "María Pérez",
      "email": "maria@test.com",
      "password": "test123",
      "birth_date": "2015-05-15"
    }
  }'
```

### 2. Login como Child

```
Email: maria@test.com
Password: test123
```

### 3. Ir a "Lecciones V.2"

- ✅ Debería mostrar: "Tu edad: 9 años"
- ✅ Debería mostrar: Badge "8-10 años"
- ✅ Debería mostrar lecciones de "Exploradores Financieros"

### 4. Verificar en Console

```
F12 → Console
Buscar: "✅ Edad calculada: 9 años → Rango: 8-10"
```

---

## 🚨 Manejo de Casos Especiales

### Si no hay fecha de nacimiento:
```typescript
if (!user.birth_date) {
  console.warn('User does not have birth_date');
  // Mantiene el rango por defecto: "8-10"
}
```

### Si hay error al calcular:
```typescript
catch (error) {
  console.error('Error al calcular edad:', error);
  // El sistema sigue funcionando con el rango por defecto
}
```

### Si el usuario no está en localStorage:
```typescript
if (!userStr) {
  console.error('No user found in localStorage');
  // El sistema muestra las lecciones por defecto
}
```

---

## 📋 Requisitos

Para que el sistema funcione correctamente:

1. ✅ El usuario debe tener `birth_date` en su registro
2. ✅ El usuario debe estar guardado en localStorage después del login
3. ✅ La fecha debe estar en formato ISO (YYYY-MM-DD)

---

## 🔄 Actualización de Edad

La edad se calcula **cada vez que se carga el componente**, lo que significa:

- Si el child cumple años, la próxima vez que entre a Lecciones V.2 verá su nueva edad
- El rango de lecciones se actualizará automáticamente si cambió de categoría
- No hay necesidad de recalcular manualmente

---

## 📊 Lógica de Negocio

### Transición Entre Rangos

```
Child con 10 años:
  → Muestra lecciones 8-10 años

Child cumple 11 años:
  → Automáticamente cambia a lecciones 11-13 años

Child cumple 14 años:
  → Automáticamente cambia a lecciones 14-16 años
```

### Progreso Preservado

El progreso del usuario en cada lección se mantiene independientemente del cambio de rango, gracias a la tabla `user_lesson_progress` en la base de datos.

---

## ✨ Resultado Final

- ✅ Selector manual **eliminado**
- ✅ Cálculo automático de edad **implementado**
- ✅ Asignación automática de rango **funcionando**
- ✅ Interfaz informativa **mejorada**
- ✅ Indicador de carga **agregado**
- ✅ Manejo de errores **implementado**

---

**¡Sistema de lecciones automáticas por edad completamente funcional!** 🎓✨

