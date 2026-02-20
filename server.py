#!/usr/bin/env python3
"""
Simple HTTPS Server para desarrollo local
Genera un certificado autofirmado y sirve el contenido seguro
"""
import http.server
import ssl
import os
import sys
from pathlib import Path
import socket

os.chdir(Path(__file__).parent)

cert_file = "cert.pem"
key_file = "key.pem"

# Crear certificado si no existe
if not os.path.exists(cert_file) or not os.path.exists(key_file):
    print("📝 Generando certificado autofirmado...")
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        from datetime import datetime, timedelta
        
        # Generar clave
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        # Crear certificado
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow()
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName(u"localhost"),
                x509.DNSName(u"127.0.0.1"),
                x509.IPAddress(ipaddress.IPv4Address(u"127.0.0.1")),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256(), default_backend())
        
        # Guardar archivos
        with open(cert_file, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        with open(key_file, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        print("✓ Certificado generado correctamente")
    except ImportError:
        print("Instalando dependencias...")
        os.system("pip install cryptography -q")
        print("Ejecuta el script nuevamente")
        sys.exit(1)

# Crear handler
class SimpleHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"  {format % args}")

# Crear y configurar servidor
port = 8000
server = http.server.HTTPServer(("0.0.0.0", port), SimpleHandler)

# Configurar SSL con parámetros más permisivos
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(cert_file, key_file)
context.check_hostname = False
context.verify_mode = ssl.CERT_NONE

server.socket = context.wrap_socket(server.socket, server_side=True)

print("""
╔════════════════════════════════════════╗
║    ✓ SERVIDOR HTTPS INICIADO           ║
╠════════════════════════════════════════╣
║ URL: https://localhost:8000            ║
║                                        ║
║ En el navegador:                       ║
║ 1. Ignora advertencia de certificado   ║
║ 2. Haz clic en "Continuar de todas"    ║
║ 3. La cámara debería funcionar         ║
╚════════════════════════════════════════╝
""")

try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\n✓ Servidor detenido")

