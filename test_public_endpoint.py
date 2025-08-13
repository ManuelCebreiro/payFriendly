#!/usr/bin/env python3
"""
Script de prueba para verificar el endpoint público
"""

import json

import requests


def test_public_endpoint():
    base_url = "http://localhost:8000"
    
    # Probar con un grupo que sabemos que existe
    group_id = 1
    
    print(f"Probando endpoint público para grupo {group_id}...")
    
    try:
        response = requests.get(f"{base_url}/public/overdue/{group_id}")
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Respuesta exitosa:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("Error: No se puede conectar al servidor. Asegúrate de que esté corriendo en http://localhost:8000")
    except Exception as e:
        print(f"Error inesperado: {e}")

if __name__ == "__main__":
    test_public_endpoint()
