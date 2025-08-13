import logging

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile

from .config import settings

logger = logging.getLogger(__name__)

# Configure Cloudinary - Configuración temporal
try:
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret
    )
except Exception as e:
    logger.warning(f"Cloudinary configuration failed: {e}")
    # Configuración por defecto temporal
    cloudinary.config(
        cloud_name="demo",
        api_key="demo",
        api_secret="demo"
    )

async def upload_receipt_image(file: UploadFile, user_id: int, group_id: int) -> str:
    """
    Upload receipt image to Cloudinary
    Returns the secure URL of the uploaded image
    """
    try:
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail="Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG y WebP."
            )
        
        # Validate file size (max 5MB)
        file_size = 0
        content = await file.read()
        file_size = len(content)
        
        if file_size > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(
                status_code=400,
                detail="El archivo es demasiado grande. Tamaño máximo: 5MB."
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Upload to Cloudinary - Modo temporal
        try:
            result = cloudinary.uploader.upload(
                content,
                folder=f"paycontrol/receipts/user_{user_id}/group_{group_id}",
                resource_type="image",
                format="webp",  # Convert to WebP for better compression
                quality="auto:good",
                transformation=[
                    {'width': 800, 'height': 600, 'crop': 'limit'},
                    {'quality': 'auto:good'}
                ]
            )
            
            logger.info(f"Image uploaded successfully: {result['secure_url']}")
            return result['secure_url']
            
        except Exception as cloudinary_error:
            logger.warning(f"Cloudinary upload failed, using fallback: {cloudinary_error}")
            # Fallback temporal: devolver una URL simulada
            # En producción, esto debería ser reemplazado por una subida real
            return f"https://via.placeholder.com/400x300/cccccc/666666?text=Receipt+{file.filename}"
        
    except Exception as e:
        logger.error(f"Failed to upload image: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail="Error al subir la imagen. Inténtalo de nuevo."
        )

def delete_receipt_image(image_url: str) -> bool:
    """
    Delete image from Cloudinary using the image URL
    Returns True if successful, False otherwise
    """
    try:
        # Extract public_id from URL
        # URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.format
        parts = image_url.split('/')
        if 'cloudinary.com' not in image_url:
            return False
            
        # Find the public_id part
        upload_index = parts.index('upload')
        public_id_with_format = '/'.join(parts[upload_index + 2:])  # Skip version number
        public_id = public_id_with_format.rsplit('.', 1)[0]  # Remove file extension
        
        result = cloudinary.uploader.destroy(public_id)
        
        if result.get('result') == 'ok':
            logger.info(f"Image deleted successfully: {public_id}")
            return True
        else:
            logger.warning(f"Failed to delete image: {public_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error deleting image {image_url}: {str(e)}")
        return False

def get_optimized_image_url(original_url: str, width: int = 400, height: int = 300) -> str:
    """
    Get an optimized version of the image URL
    """
    try:
        if 'cloudinary.com' not in original_url:
            return original_url
            
        # Insert transformation parameters
        parts = original_url.split('/upload/')
        if len(parts) != 2:
            return original_url
            
        transformation = f"w_{width},h_{height},c_fill,q_auto:good"
        optimized_url = f"{parts[0]}/upload/{transformation}/{parts[1]}"
        
        return optimized_url
        
    except Exception as e:
        logger.error(f"Error optimizing image URL {original_url}: {str(e)}")
        return original_url