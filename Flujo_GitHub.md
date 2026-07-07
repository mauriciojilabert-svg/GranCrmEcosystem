# Flujo de Trabajo con GitHub (Windows ➔ Servidor QA)

Para trabajar de forma segura y sin perder código, GitHub actúa como el puente central. Ya no enviaremos archivos directamente desde Windows al servidor usando WinSCP. Ahora todo pasa por la bóveda central de GitHub.

<br>

<img src="https://quickchart.io/graphviz?graph=digraph%20G%20%7B%0A%20%20rankdir%3DLR%3B%0A%20%20node%20%5Bshape%3Dbox%2C%20style%3Dfilled%2C%20fillcolor%3D%22%23ffffff%22%2C%20fontname%3D%22Arial%22%2C%20fontsize%3D12%2C%20penwidth%3D2%2C%20color%3D%22%23333333%22%5D%3B%0A%20%20edge%20%5Bfontname%3D%22Arial%22%2C%20fontsize%3D11%2C%20color%3D%22%23666666%22%2C%20penwidth%3D1.5%5D%3B%0A%0A%20%20Windows%20%5Blabel%3D%221.%20TU%20COMPUTADORA%5Cn%28Windows%20%2F%20VS%20Code%29%5Cn%5CnEdicion%20de%20Codigo%22%2C%20fillcolor%3D%22%23d0e8ff%22%2C%20shape%3Dfolder%5D%3B%0A%20%20GitHub%20%5Blabel%3D%222.%20GITHUB%5Cn%28Nube%29%5Cn%5CnRespaldo%20Central%22%2C%20fillcolor%3D%22%23e6ffed%22%2C%20shape%3Dcylinder%5D%3B%0A%20%20QA%20%5Blabel%3D%223.%20SERVIDOR%20QA%5Cn%28PuTTY%20%2F%20Linux%29%5Cn%5CnDespliegue%20y%20Ejecucion%22%2C%20fillcolor%3D%22%23ffdce0%22%2C%20shape%3Dfolder%5D%3B%0A%0A%20%20Windows%20-%3E%20GitHub%20%5Blabel%3D%22%20%20A.%20Subir%20Codigo%5Cn%20%20%28Push%29%20%20%22%2C%20color%3D%22%23005cc5%22%2C%20fontcolor%3D%22%23005cc5%22%2C%20style%3Dbold%5D%3B%0A%20%20GitHub%20-%3E%20QA%20%5Blabel%3D%22%20%20B.%20Bajar%20Codigo%5Cn%20%20%28Pull%29%20%20%22%2C%20color%3D%22%2328a745%22%2C%20fontcolor%3D%22%2328a745%22%2C%20style%3Dbold%5D%3B%0A%7D" alt="Diagrama Flujo Git" style="width:100%; max-width:800px; display:block; margin: 0 auto;" />

---

## PASO A (Tu Computadora / VS Code) - *Subir Cambios*

Cada vez que termines de programar una nueva función o arreglar un bug en tu computadora, debes empujar (Push) tus cambios hacia GitHub.

Como usas VS Code en Windows, puedes hacerlo visualmente desde la pestaña de *Source Control* (Git), pero si en algún momento necesitas usar comandos en la terminal de tu VS Code, este es el flujo universal:

```bash
# 1. Preparar todos los archivos que modificaste
git add .

# 2. Guardar los cambios con un mensaje explicativo (Commit)
git commit -m "Reparado error en barra lateral de InciTrack"

# 3. Subir el paquete de código a la nube (GitHub)
git push
```
> [!TIP]
> En la interfaz gráfica de VS Code, esto equivale a ir a la pestaña Git, escribir el mensaje en la caja de texto, darle al botón azul **"Commit"** y luego hacer clic en **"Sync Changes" (Sincronizar cambios)**.

<div style="page-break-before: always;"></div>

## PASO B (PuTTY / Servidor Linux QA) - *Descargar Cambios*

Una vez que GitHub ya tiene tu nuevo código a salvo, abres tu sesión de PuTTY para conectarte al servidor donde corre Docker y simplemente "jalar" (Pull) los cambios. 

```bash
# 1. Vas a la carpeta donde vive tu proyecto en el servidor
cd /rutas/a/tu/proyecto/GRANCRMecosystem

# 2. Descargas el código exacto que acabas de subir desde tu Windows
git pull

# 3. Reinicias los contenedores de Docker para que tomen el código fresco
sudo docker compose restart
```

> [!IMPORTANT]
> Nunca modifiques ni escribas código directamente en el servidor a través de PuTTY o WinSCP. Si lo haces, el comando `git pull` arrojará un error porque detectará que hay código mezclado. **El servidor es solo para ejecutar, no para programar.**
