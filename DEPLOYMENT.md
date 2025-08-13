# Guía de Deployment - PayControl

## 🚀 Deployment del Backend en Render

### Paso 1: Preparación del Repositorio

1. **Asegúrate de que tu código esté en GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

### Paso 2: Configuración en Render

1. **Crear cuenta en Render**
   - Ve a [render.com](https://render.com)
   - Regístrate con tu cuenta de GitHub

2. **Crear Web Service**
   - Click en "New +" → "Web Service"
   - Conecta tu repositorio de GitHub
   - Selecciona el repositorio `payControl`

3. **Configuración del Servicio**
   ```
   Name: paycontrol-backend
   Environment: Python 3
   Build Command: pip install -r backend/requirements.txt
   Start Command: cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

### Paso 3: Variables de Entorno

Configura estas variables en Render Dashboard:

```env
# Base de datos (Render te dará esta URL automáticamente si creas una DB)
DATABASE_URL=postgresql://user:password@host:port/database

# JWT Secret (genera uno seguro)
JWT_SECRET_KEY=tu-jwt-secret-muy-seguro-aqui

# Email (configura con tu proveedor SMTP)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password

# Cloudinary (copia de tu .env local)
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret

# Frontend URL (actualizar cuando despliegues el frontend)
FRONTEND_URL=https://tu-app.vercel.app

# Environment
ENVIRONMENT=production
```

### Paso 4: Base de Datos

**Opción A: PostgreSQL de Render (Recomendado para empezar)**
1. En Render Dashboard → "New +" → "PostgreSQL"
2. Nombre: `paycontrol-db`
3. Copia la `DATABASE_URL` a las variables de entorno del web service

**Opción B: Supabase (Más features)**
1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ve a Settings → Database
3. Copia la connection string a `DATABASE_URL`

### Paso 5: Migraciones

Después del primer deploy:
1. Ve a tu servicio en Render
2. Abre la "Shell" (terminal)
3. Ejecuta las migraciones:
   ```bash
   cd backend
   alembic upgrade head
   ```

### Paso 6: Verificación

1. **Verifica que el servicio esté corriendo**
   - URL: `https://tu-servicio.onrender.com`
   - Health check: `https://tu-servicio.onrender.com/health`

2. **Prueba los endpoints**
   ```bash
   curl https://tu-servicio.onrender.com/api/health
   ```

## 🎯 Deployment del Frontend en Vercel

### Paso 1: Configuración en Vercel

1. **Crear cuenta en Vercel**
   - Ve a [vercel.com](https://vercel.com)
   - Regístrate con GitHub

2. **Importar Proyecto**
   - "New Project" → Selecciona tu repo
   - Framework: Next.js (auto-detectado)
   - Root Directory: `frontend`

### Paso 2: Variables de Entorno en Vercel

```env
NEXT_PUBLIC_API_URL=https://tu-backend.onrender.com
```

### Paso 3: Configuración de Build

```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/.next",
  "installCommand": "cd frontend && npm install"
}
```

## 🔧 Troubleshooting

### Problemas Comunes

1. **Error de CORS**
   - Actualiza `FRONTEND_URL` en las variables de entorno del backend
   - Verifica la configuración de CORS en `main.py`

2. **Error de Base de Datos**
   - Verifica que `DATABASE_URL` esté correcta
   - Ejecuta las migraciones manualmente

3. **Error de Build**
   - Verifica que `requirements.txt` esté actualizado
   - Revisa los logs de build en Render

### Comandos Útiles

```bash
# Ver logs en tiempo real
render logs --service=paycontrol-backend

# Ejecutar migraciones
render shell --service=paycontrol-backend
cd backend && alembic upgrade head

# Reiniciar servicio
render restart --service=paycontrol-backend
```

## 📝 Notas Importantes

- **Free Tier**: Render free tier "duerme" después de 15 min de inactividad
- **Cold Starts**: El primer request después de dormir puede tardar 30-60 segundos
- **Logs**: Siempre revisa los logs para debugging
- **Environment Variables**: Nunca commitees secrets al repositorio

## 🔄 Actualizaciones

Para actualizar tu deployment:
1. Push cambios a GitHub
2. Render auto-despliega desde la rama main
3. Vercel auto-despliega desde la rama main

¡Tu aplicación estará disponible en:
- Backend: `https://paycontrol-backend.onrender.com`
- Frontend: `https://paycontrol.vercel.app`