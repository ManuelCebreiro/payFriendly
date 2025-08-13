# PayControl Backend

API REST desarrollada con FastAPI para la gestión de pagos compartidos en grupos.

## Características

- **Autenticación JWT**: Registro, login y recuperación de contraseña
- **Gestión de Grupos**: Crear, editar y administrar grupos de pago
- **Pagos**: Registrar pagos con comprobantes (Cloudinary)
- **Dashboard**: Estadísticas y resumen de actividad
- **URLs Públicas**: Compartir grupos con Open Graph
- **Base de Datos**: PostgreSQL con migraciones Alembic

## Instalación

### Prerrequisitos

- Python 3.8+
- PostgreSQL
- Cuenta de Cloudinary
- Servidor SMTP (Gmail, SendGrid, etc.)

### Configuración

1. **Instalar dependencias**:
```bash
pip install -r requirements.txt
```

2. **Configurar variables de entorno**:
```bash
cp .env.example .env
```

Editar `.env` con tus configuraciones:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/paycontrol_db
SECRET_KEY=tu-clave-secreta-muy-segura
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
SMTP_SERVER=smtp.gmail.com
SMTP_USERNAME=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
FROM_EMAIL=tu-email@gmail.com
```

3. **Crear base de datos**:
```sql
CREATE DATABASE paycontrol_db;
```

4. **Ejecutar migraciones**:
```bash
alembic upgrade head
```

## Uso

### Desarrollo
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Producción
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Endpoints Principales

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Perfil del usuario
- `POST /api/auth/request-password-reset` - Solicitar recuperación
- `POST /api/auth/reset-password` - Restablecer contraseña

### Grupos
- `GET /api/groups/` - Listar grupos del usuario
- `POST /api/groups/` - Crear grupo
- `GET /api/groups/{id}` - Obtener grupo
- `PUT /api/groups/{id}` - Actualizar grupo
- `DELETE /api/groups/{id}` - Eliminar grupo
- `GET /api/groups/public/{public_id}` - Vista pública del grupo

### Pagos
- `POST /api/payments/` - Registrar pago (con comprobante)
- `GET /api/payments/group/{group_id}` - Pagos del grupo
- `GET /api/payments/my-payments` - Mis pagos
- `PUT /api/payments/{id}` - Actualizar pago
- `DELETE /api/payments/{id}` - Eliminar pago

### Dashboard
- `GET /api/dashboard/stats` - Estadísticas generales
- `GET /api/dashboard/recent-activity` - Actividad reciente
- `GET /api/dashboard/notifications` - Notificaciones

## Estructura del Proyecto

```
backend/
├── app/
│   ├── routers/          # Endpoints de la API
│   ├── models.py         # Modelos SQLAlchemy
│   ├── schemas.py        # Esquemas Pydantic
│   ├── auth.py           # Autenticación JWT
│   ├── database.py       # Configuración DB
│   ├── config.py         # Configuración
│   ├── email_utils.py    # Utilidades de email
│   ├── cloudinary_utils.py # Integración Cloudinary
│   └── main.py           # Aplicación principal
├── alembic/              # Migraciones de DB
├── requirements.txt      # Dependencias
└── .env.example          # Variables de entorno
```

## Migraciones

```bash
# Crear nueva migración
alembic revision --autogenerate -m "descripción"

# Aplicar migraciones
alembic upgrade head

# Revertir migración
alembic downgrade -1
```

## Configuración de Email

### Gmail
1. Habilitar autenticación de 2 factores
2. Generar contraseña de aplicación
3. Usar la contraseña de aplicación en `SMTP_PASSWORD`

### SendGrid
```env
SMTP_SERVER=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=tu-api-key-de-sendgrid
```

## Configuración de Cloudinary

1. Crear cuenta en [Cloudinary](https://cloudinary.com/)
2. Obtener credenciales del Dashboard
3. Configurar en `.env`

## Seguridad

- Tokens JWT con expiración
- Contraseñas hasheadas con bcrypt
- Validación de archivos subidos
- CORS configurado
- Rate limiting (recomendado para producción)

## Monitoreo

- Logs estructurados
- Health check en `/health`
- Métricas de API disponibles

## Contribuir

1. Fork del repositorio
2. Crear rama feature
3. Commit cambios
4. Push a la rama
5. Crear Pull Request