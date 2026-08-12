import sys
import traceback

file_path = r"C:\Users\Mauricio\Documents\GRANCRMecosystem\grancrm\incitrack\tickets\api.py"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

out = []
in_dash = False

for i, line in enumerate(lines):
    if line.startswith("def dashboard("):
        in_dash = True
        out.append(line)
        out.append("    import traceback\n")
        out.append("    try:\n")
        continue

    if in_dash and line.startswith("def "):
        in_dash = False
        out.append("    except Exception as e:\n")
        out.append("        return 500, {\"detail\": f\"Error: {e}\\n\\n{traceback.format_exc()}\"}\n")
        out.append("\n")

    if in_dash:
        if line.strip() == "import traceback" or line.strip() == "try:":
            continue
        
        if line.strip() == "":
            out.append("\n")
        else:
            if line.startswith("    ") and not line.startswith("        "):
                out.append("    " + line)
            elif line.startswith("        "):
                # already inside the try block from my previous partial edit
                out.append(line)
            else:
                out.append("    " + line)
    else:
        out.append(line)

if in_dash:
    out.append("    except Exception as e:\n")
    out.append("        return 500, {\"detail\": f\"Error: {e}\\n\\n{traceback.format_exc()}\"}\n")

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(out)
