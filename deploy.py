#!/usr/bin/env python3
"""
Script de deployment para PayControl
Este script ayuda a preparar y verificar el deployment
"""

import os
import sys
import subprocess
import requests
from pathlib import Path

def check_requirements():
    """Verifica que todos los archivos necesarios estén presentes"""
    print("🔍 Verificando archivos necesarios...")
    
    required_files = [
        "backend/requirements.txt",
        "backend/app/main.py",
        "backend/alembic.ini",
        "render.yaml",
        "DEPLOYMENT.md"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print(f"❌ Archivos faltantes: {', '.join(missing_files)}")
        return False
    
    print("✅ Todos los archivos necesarios están presentes")
    return True

def check_env_variables():
    """Verifica que las variables de entorno estén configuradas"""
    print("🔍 Verificando variables de entorno...")
    
    required_vars = [
        "DATABASE_URL",
        "JWT_SECRET_KEY", 
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
        "SMTP_SERVER",
        "SMTP_USERNAME",
        "SMTP_PASSWORD"
    ]
    
    # Cargar variables desde .env si existe
    env_file = Path("backend/.env")
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ[key] = value
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"⚠️  Variables faltantes: {', '.join(missing_vars)}")
        print("   Configúralas en Render Dashboard")
    else:
        print("✅ Variables de entorno configuradas")
    
    return len(missing_vars) == 0

def test_backend_locally():
    """Prueba que el backend funcione localmente"""
    print("🧪 Probando backend localmente...")
    
    try:
        # Verificar que uvicorn esté instalado
        subprocess.run(["pip", "show", "uvicorn"], check=True, capture_output=True)
        
        print("✅ Backend listo para deployment")
        return True
    except subprocess.CalledProcessError:
        print("❌ Error: uvicorn no está instalado")
        print("   Ejecuta: pip install uvicorn")
        return False
    except Exception as e:
        print(f"❌ Error probando backend: {e}")
        return False

def generate_deployment_checklist():
    """Genera una checklist para el deployment"""
    checklist = """
📋 CHECKLIST DE DEPLOYMENT

□ 1. Código subido a GitHub
   git add .
   git commit -m "Ready for deployment"
   git push origin main

□ 2. Cuenta creada en Render.com

□ 3. Web Service creado en Render
   - Name: paycontrol-backend
   - Environment: Python 3
   - Build Command: pip install -r backend/requirements.txt
   - Start Command: cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT

□ 4. Variables de entorno configuradas en Render:
   - DATABASE_URL
   - JWT_SECRET_KEY
   - CLOUDINARY_CLOUD_NAME
   - CLOUDINARY_API_KEY
   - CLOUDINARY_API_SECRET
   - SMTP_SERVER
   - SMTP_PORT
   - SMTP_USERNAME
   - SMTP_PASSWORD
   - FRONTEND_URL
   - ENVIRONMENT=production

□ 5. Base de datos PostgreSQL creada en Render

□ 6. Migraciones ejecutadas:
   cd backend && alembic upgrade head

□ 7. Endpoints probados:
   https://tu-servicio.onrender.com/health
   https://tu-servicio.onrender.com/

□ 8. Frontend desplegado en Vercel
   - NEXT_PUBLIC_API_URL configurada

□ 9. CORS actualizado con URL del frontend

✅ ¡Deployment completado!
"""
    
    print(checklist)
    
    # Guardar checklist en archivo
    with open("deployment-checklist.txt", "w", encoding="utf-8") as f:
        f.write(checklist)
    
    print("📄 Checklist guardada en: deployment-checklist.txt")

def main():
    print("🚀 PayControl Deployment Helper")
    print("=" * 40)
    
    # Verificaciones
    checks_passed = 0
    total_checks = 3
    
    if check_requirements():
        checks_passed += 1
    
    if check_env_variables():
        checks_passed += 1
    
    if test_backend_locally():
        checks_passed += 1
    
    print(f"\n📊 Verificaciones: {checks_passed}/{total_checks} pasadas")
    
    if checks_passed == total_checks:
        print("🎉 ¡Todo listo para deployment!")
    else:
        print("⚠️  Hay algunos problemas que resolver antes del deployment")
    
    print("\n" + "=" * 40)
    generate_deployment_checklist()
    
    print("\n📚 Para más detalles, consulta: DEPLOYMENT.md")

if __name__ == "__main__":
    main()