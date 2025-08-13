# PayControl Frontend

Frontend de la aplicación PayControl desarrollado con Next.js, React y TypeScript.

## Características

- **Framework**: Next.js 14 con App Router
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Componentes UI**: Headless UI + componentes personalizados
- **Formularios**: React Hook Form + Zod
- **Autenticación**: Context API con JWT
- **Notificaciones**: Sistema de toast personalizado
- **Iconos**: Heroicons + Lucide React

## Instalación

### Prerrequisitos

- Node.js 18+ 
- npm o yarn
- Backend de PayControl ejecutándose

### Configuración

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**:
   ```bash
   cp .env.example .env.local
   ```
   
   Editar `.env.local` con tus configuraciones:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=tu_upload_preset
   ```

## Desarrollo

```bash
# Ejecutar en modo desarrollo
npm run dev

# Construir para producción
npm run build

# Ejecutar en producción
npm start

# Linting
npm run lint
```

La aplicación estará disponible en `http://localhost:3000`

## Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
│   ├── ui/             # Componentes base (Button, Input, etc.)
│   └── layout/         # Componentes de layout
├── contexts/           # Contextos de React
├── lib/               # Utilidades y configuraciones
├── pages/             # Páginas de Next.js
├── styles/            # Estilos globales
└── types/             # Definiciones de TypeScript
```

## Componentes Principales

### Componentes UI
- `Button`: Botón reutilizable con variantes
- `Input`: Campo de entrada con validación
- `Modal`: Modal con transiciones
- `Card`: Tarjeta con header, body y footer
- `Badge`: Etiquetas de estado
- `Loading`: Indicador de carga
- `Dropdown`: Menú desplegable
- `Toast`: Sistema de notificaciones

### Layout
- `Layout`: Layout principal con navegación
- `AuthLayout`: Layout para páginas de autenticación

### Páginas
- `/`: Página de inicio (redirección)
- `/login`: Inicio de sesión
- `/register`: Registro de usuario
- `/dashboard`: Panel principal
- `/groups`: Gestión de grupos
- `/payments`: Gestión de pagos

## Autenticación

La autenticación se maneja mediante:
- Context API (`AuthContext`)
- JWT tokens almacenados en cookies
- Interceptores de Axios para manejo automático de tokens
- Redirección automática en caso de sesión expirada

## Estilos

- **Tailwind CSS**: Framework de utilidades CSS
- **Componentes personalizados**: Estilos reutilizables
- **Tema personalizado**: Colores y espaciado consistente
- **Responsive**: Diseño adaptable a diferentes pantallas

## Manejo de Estado

- **Context API**: Para estado global (autenticación)
- **React Hook Form**: Para formularios
- **Estado local**: Para componentes específicos

## Validación

- **Zod**: Esquemas de validación TypeScript-first
- **React Hook Form**: Integración con validación
- **Validación en tiempo real**: Feedback inmediato al usuario

## Notificaciones

- Sistema de toast personalizado
- Diferentes tipos: success, error, warning, info
- Auto-dismiss configurable
- Posicionamiento responsive

## Configuración de Desarrollo

### ESLint
Configuración incluida para mantener calidad de código.

### TypeScript
Configuración estricta para mejor desarrollo.

### Tailwind CSS
Configuración personalizada con:
- Colores de marca
- Animaciones personalizadas
- Componentes reutilizables

## Despliegue

### Vercel (Recomendado)
```bash
npm run build
# Desplegar en Vercel
```

### Docker
```dockerfile
# Dockerfile incluido para contenedorización
docker build -t paycontrol-frontend .
docker run -p 3000:3000 paycontrol-frontend
```

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | URL del backend | `http://localhost:8000` |
| `NEXT_PUBLIC_FRONTEND_URL` | URL del frontend | `http://localhost:3000` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Nombre de Cloudinary | `tu_cloud_name` |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Preset de Cloudinary | `tu_upload_preset` |

## Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT.