# Flujo de Trabajo con GitHub (Windows ➔ QA ➔ Producción)

Para trabajar de forma segura y sin perder código, GitHub actúa como el puente central. Ya no enviaremos archivos directamente desde Windows al servidor usando WinSCP. Ahora todo pasa por la bóveda central de GitHub.

## Estructura de Ramas

| Rama | Servidor | IP | Para qué |
|------|----------|----|----------|
| `qa` | QA | 172.20.21.249 | Desarrollo y pruebas |
| `main` | Producción | 172.20.21.10 | Código estable para clientes |

> [!IMPORTANT]
> **Regla de oro:** Siempre trabaja en la rama `qa`. Solo cuando todo esté probado y funcionando, fusiona hacia `main` para subir a producción.

> [!WARNING]
> El archivo `.env` **NO se sube a GitHub**. Cada servidor tiene su propio `.env` con sus credenciales. Si necesitas cambiar una variable de entorno, edítala directamente en el servidor con `sudo nano .env`.

<br>

<img src="https://quickchart.io/graphviz?graph=digraph%20G%20%7B%0A%20%20rankdir%3DLR%3B%0A%20%20node%20%5Bshape%3Dbox%2C%20style%3Dfilled%2C%20fillcolor%3D%22%23ffffff%22%2C%20fontname%3D%22Arial%22%2C%20fontsize%3D12%2C%20penwidth%3D2%2C%20color%3D%22%23333333%22%5D%3B%0A%20%20edge%20%5Bfontname%3D%22Arial%22%2C%20fontsize%3D11%2C%20color%3D%22%23666666%22%2C%20penwidth%3D1.5%5D%3B%0A%0A%20%20Windows%20%5Blabel%3D%221.%20TU%20COMPUTADORA%5Cn%28Windows%20%2F%20VS%20Code%29%5Cn%5CnEdicion%20de%20Codigo%22%2C%20fillcolor%3D%22%23d0e8ff%22%2C%20shape%3Dfolder%5D%3B%0A%20%20GitHub%20%5Blabel%3D%222.%20GITHUB%5Cn%28Nube%29%5Cn%5CnRama%20qa%20%2B%20main%22%2C%20fillcolor%3D%22%23e6ffed%22%2C%20shape%3Dcylinder%5D%3B%0A%20%20QA%20%5Blabel%3D%223.%20SERVIDOR%20QA%5Cn%28172.20.21.249%29%5Cn%5CnPruebas%22%2C%20fillcolor%3D%22%23fff3cd%22%2C%20shape%3Dfolder%5D%3B%0A%20%20Prod%20%5Blabel%3D%224.%20PRODUCCION%5Cn%28172.20.21.10%29%5Cn%5CnClientes%22%2C%20fillcolor%3D%22%23ffdce0%22%2C%20shape%3Dfolder%5D%3B%0A%0A%20%20Windows%20-%3E%20GitHub%20%5Blabel%3D%22%20%20Push%20a%20qa%20%20%22%2C%20color%3D%22%23005cc5%22%2C%20fontcolor%3D%22%23005cc5%22%2C%20style%3Dbold%5D%3B%0A%20%20GitHub%20-%3E%20QA%20%5Blabel%3D%22%20%20Pull%20qa%20%20%22%2C%20color%3D%22%23e09b13%22%2C%20fontcolor%3D%22%23e09b13%22%2C%20style%3Dbold%5D%3B%0A%20%20GitHub%20-%3E%20Prod%20%5Blabel%3D%22%20%20Pull%20main%20%20%22%2C%20color%3D%22%2328a745%22%2C%20fontcolor%3D%22%2328a745%22%2C%20style%3Dbold%5D%3B%0A%7D" alt="Diagrama Flujo Git" style="width:100%; max-width:900px; display:block; margin: 0 auto;" />

---

## PASO A (Tu Computadora / VS Code) - *Desarrollo diario*

Cada vez que termines de programar una nueva función o arreglar un bug, sube tus cambios a la rama `qa`:

```bash
# 1. Asegúrate de estar en la rama qa
git checkout qa

# 2. Preparar todos los archivos que modificaste
git add .

# 3. Guardar los cambios con un mensaje explicativo (Commit)
git commit -m "Reparado error en barra lateral de InciTrack"

# 4. Subir a GitHub (rama qa)
git push origin qa
```
> [!TIP]
> En la interfaz gráfica de VS Code, verifica que abajo a la izquierda diga **"qa"** (no "main"). Si dice "main", haz clic ahí y selecciona "qa". Luego haz Commit y Sync como siempre.

<div style="page-break-before: always;"></div>

## PASO B (PuTTY / Servidor QA 249) - *Probar cambios*

Conéctate por PuTTY al servidor QA y descarga los cambios de la rama `qa`:

```bash
# 1. Ir a la carpeta del proyecto
cd /home/admincrm/grancrm

# 2. Descargar los cambios de la rama qa
git pull origin qa

# 3. Reiniciar los contenedores de Docker
sudo docker compose restart
```

---

## PASO C (Promover a Producción) - *Cuando todo funciona en QA*

Una vez que pruebes y confirmes que todo anda bien en QA, fusiona los cambios a `main` desde tu computadora:

```bash
# 1. Cambiar a la rama main
git checkout main

# 2. Traer los cambios probados de qa
git merge qa

# 3. Subir a GitHub
git push origin main
```

Luego conéctate por PuTTY al servidor de **Producción** (172.20.21.10) y descarga:

```bash
# 1. Ir a la carpeta del proyecto
cd /var/www/dash/grancrm

# 2. Descargar los cambios de main
git pull origin main

# 3. Reiniciar los contenedores
sudo docker compose restart
```

> [!IMPORTANT]
> Nunca modifiques ni escribas código directamente en el servidor a través de PuTTY o WinSCP. Si lo haces, el comando `git pull` arrojará un error porque detectará que hay código mezclado. **El servidor es solo para ejecutar, no para programar.**

> [!CAUTION]
> **Nunca hagas push directo a `main`** sin haber probado primero en QA. Siempre trabaja en `qa`, prueba, y después fusiona.
