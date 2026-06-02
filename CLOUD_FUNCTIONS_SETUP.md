# 🔧 Configurar Cloud Functions (Generación Automática de Cuotas)

## ¿Qué hacen las Cloud Functions?
1. **Día 1 de cada mes a las 8am** → genera cuotas automáticamente para todos los socios activos
2. **Todos los días medianoche** → marca como "Vencido" los pagos que pasaron su fecha límite
3. **Todos los días 9am** → envía recordatorios 3 días antes del vencimiento

---

## Pasos para activarlas

### 1. Instalar Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2. Inicializar en tu proyecto
```bash
cd yaguares-rc
firebase init functions
```
- Seleccioná tu proyecto `cobrosyaguares`
- Lenguaje: **JavaScript**
- No instales dependencias aún

### 3. Copiar el archivo functions/index.js
Ya viene en el ZIP. Solo reemplazá el que generó Firebase.

### 4. Instalar dependencias de functions
```bash
cd functions
npm install
cd ..
```

### 5. Activar plan Blaze en Firebase
Las Cloud Functions requieren el plan **Blaze** (pago por uso).
- Ve a Firebase Console → Upgrade plan → Blaze
- Costo real para este proyecto: ~$0/mes (tiene capa gratuita generosa)
- Necesitás una tarjeta de crédito para activarlo

### 6. Deploy
```bash
firebase deploy --only functions
```

---

## ⚠️ Sin Cloud Functions
Si no querés activar el plan Blaze, el botón **"Generar Cuotas"** en el Dashboard hace lo mismo manualmente. Las Cloud Functions solo automatizan ese proceso.
