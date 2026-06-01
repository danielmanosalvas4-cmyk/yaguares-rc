# 🐆 Yaguares RC — Sistema de Gestión de Cobros

Sistema completo de cobros para el club de rugby **Yaguares RC** (Guayaquil, Ecuador).

---

## 🏗️ Estructura del Proyecto

```
src/
├── config/
│   └── firebase.js          ← Configuración de Firebase (EDITAR con tus datos)
├── context/
│   └── AuthContext.js       ← Manejo de sesiones y roles
├── components/
│   ├── admin/
│   │   ├── AdminLayout.jsx  ← Protección de rutas admin
│   │   └── AdminSidebar.jsx ← Menú lateral admin
│   └── player/
│       └── PlayerLayout.jsx ← Protección de rutas jugador
├── pages/
│   ├── Login.jsx            ← Login compartido
│   ├── admin/
│   │   ├── Dashboard.jsx    ← Estadísticas y gráficos
│   │   ├── Socios.jsx       ← CRUD de socios
│   │   ├── ValidarPagos.jsx ← Aprobar/rechazar comprobantes
│   │   ├── CobrosExtraordinarios.jsx ← Viajes y eventos
│   │   ├── Reportes.jsx     ← Deudores y análisis
│   │   └── Admins.jsx       ← Gestión de admins
│   └── player/
│       └── PortalJugador.jsx ← Portal del jugador (pagar, ver historial)
└── App.jsx                  ← Rutas principales
```

---

## 🚀 Paso a Paso para Lanzar

### 1. Configurar Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un proyecto → **"yaguares-rc"**
3. Activa los siguientes servicios:
   - **Authentication** → Email/Password
   - **Firestore Database** → Modo producción
   - **Storage** → Para los comprobantes

4. En **Configuración del proyecto → Tus apps → Web**, copia los datos y pégalos en `src/config/firebase.js`

5. En **Firestore**, sube las reglas del archivo `firestore.rules`

### 2. Crear el Primer Administrador

1. En Firebase Console → **Authentication → Agregar usuario** → ingresa el email y contraseña del primer admin
2. Copia el **UID** del usuario creado
3. En **Firestore → Crear colección** → `admins` → Nuevo documento con ID = el UID copiado → Agrega campo `nombre` y `email`

### 3. Configurar Payphone (Tarjeta de Débito)

1. Registrarte en [payphone.app](https://payphone.app)
2. Ir a **Configuración → API → Botón de pago**
3. Copiar tu **Token** y **Store ID**
4. En `src/pages/player/PortalJugador.jsx`, líneas 14-15:
   ```js
   const PAYPHONE_TOKEN = "TU_TOKEN_AQUÍ";
   const PAYPHONE_STORE_ID = "TU_STORE_ID_AQUÍ";
   ```
5. Verificar que tu cuenta bancaria esté vinculada en Payphone

### 4. Instalar y Correr Localmente

```bash
npm install
npm start
```

### 5. Deploy en Netlify

**Opción A — Arrastrar carpeta:**
```bash
npm run build
# Arrastra la carpeta "build/" a netlify.com/drop
```

**Opción B — Conectar con GitHub (recomendado):**
1. Sube el proyecto a un repositorio privado en GitHub
2. En Netlify → **Add new site → Import from GitHub**
3. Build command: `npm run build`
4. Publish directory: `build`
5. El archivo `netlify.toml` ya está configurado ✅

---

## 📋 Flujos de Uso

### Administrador
1. Entra a `tudominio.com/login?rol=admin`
2. Crea socios desde **Socios → Nuevo Socio** (se crea automáticamente su acceso)
3. Crea cobros extraordinarios desde **Cobros Extraordinarios** (asigna por categoría o individual, con montos distintos)
4. Valida comprobantes desde **Validar Pagos** (aprueba o rechaza con nota)
5. Revisa reportes y deudores desde **Reportes**

### Jugador
1. Entra a `tudominio.com/login` (o `tudominio.com/portal`)
2. Ve sus cuotas y cobros pendientes
3. Paga subiendo foto de depósito/transferencia → queda "En revisión" hasta que admin apruebe
4. O paga con tarjeta de débito via Payphone → aprobación inmediata

---

## 💰 Costos Estimados

| Servicio | Costo |
|----------|-------|
| Firebase (Spark) | Gratis hasta ~50k lecturas/día |
| Netlify | Gratis (hobby) |
| Payphone | Gratis de integrar, ~3.5% por transacción con tarjeta |

---

## 🎨 Colores del Club

- **Verde principal:** `#1a6b3a`
- **Verde claro:** `#23a05a`
- **Negro:** `#0d0d0d`
- **Dorado:** `#c9a84c`

---

## 📞 Soporte

Para problemas con Firebase: [firebase.google.com/docs](https://firebase.google.com/docs)  
Para Payphone: [developers.payphone.app](https://developers.payphone.app)
