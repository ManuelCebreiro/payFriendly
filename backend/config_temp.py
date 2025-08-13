# Configuración temporal para Cloudinary
# Reemplaza estos valores con tus credenciales reales de Cloudinary

CLOUDINARY_CONFIG = {
    "cloud_name": "tu_cloud_name",  # Reemplaza con tu cloud name
    "api_key": "tu_api_key_real",   # Reemplaza con tu API key real
    "api_secret": "tu_api_secret_real"  # Reemplaza con tu API secret real
}

# Para usar esta configuración, modifica cloudinary_utils.py temporalmente:
# cloudinary.config(
#     cloud_name=CLOUDINARY_CONFIG["cloud_name"],
#     api_key=CLOUDINARY_CONFIG["api_key"],
#     api_secret=CLOUDINARY_CONFIG["api_secret"]
# )
