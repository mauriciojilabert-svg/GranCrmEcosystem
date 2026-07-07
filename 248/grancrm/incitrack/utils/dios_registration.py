"""
Copiar este archivo a utils/dios_registration.py en cada nueva app del ecosistema GranCRM.
Llamar register_with_dios() y notify_schema_updated() desde AppConfig.ready().
"""
import json
import os
import urllib.request


def _load_config():
    config_path = os.environ.get('DIOS_CONFIG_PATH', '/app/dios.json')
    with open(config_path, encoding='utf-8-sig') as f:
        return json.load(f)


def _post_json(url, data):
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.read()


def register_with_dios():
    """Registra (o actualiza) la app en DIOS al arrancar."""
    dios_url = os.environ.get('DIOS_URL', 'http://orquestador:9000')
    try:
        config = _load_config()
        _post_json(f'{dios_url}/internal/register-app/', config)
    except Exception:
        pass  # fallo silencioso — la app arranca igual si DIOS no está disponible


def notify_schema_updated():
    """Notifica a DIOS que el schema puede haber cambiado.
    DIOS calcula el diff y aplica los cambios aditivos a todos los tenants en background.
    """
    dios_url = os.environ.get('DIOS_URL', 'http://orquestador:9000')
    try:
        config = _load_config()
        _post_json(
            f'{dios_url}/internal/schema-updated/',
            {'secret': config['secret'], 'nombre': config['nombre']},
        )
    except Exception:
        pass  # fallo silencioso
