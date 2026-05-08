import csv, json, re
from datetime import datetime

ARQUIVO_CSV = "movimentacoes.csv"
ARQUIVO_JSON = "dados_movimentacoes.json"

def get(row, names):
    mapa = {str(k).strip().lower(): k for k in row.keys()}
    for n in names:
        k = str(n).strip().lower()
        if k in mapa:
            return row.get(mapa[k], "")
    return ""

def clean_animal(v):
    s = str(v or "").strip()
    s = re.sub(r"\.0$", "", s)
    if "E+" in s.upper() or "E-" in s.upper():
        return ""
    dig = re.sub(r"\D", "", s)
    return dig.zfill(6) if dig else ""

def parse_date(v):
    s = str(v or "").strip()
    if not s:
        return "", ""
    s0 = s.split()[0]
    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"]:
        try:
            d = datetime.strptime(s0, fmt)
            return d.strftime("%Y-%m-%d"), d.strftime("%d/%m/%Y")
        except Exception:
            pass
    return s0, s0

def to_float(v):
    s = str(v or "").strip()
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except Exception:
        return 0.0

with open(ARQUIVO_CSV, "r", encoding="utf-8-sig", newline="") as f:
    sample = f.read(4096)
    f.seek(0)
    dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
    rows = list(csv.DictReader(f, dialect=dialect))

dados = []
for r in rows:
    animal = clean_animal(get(r, ["Nome usual", "nome_usual", "Nome_usual", "Animal"]))
    if not animal:
        continue
    data, data_br = parse_date(get(r, ["Data_transferencia", "Data transferencia", "data", "Data"]))
    dados.append({
        "nome_usual": animal,
        "sx": get(r, ["Sx", "sx", "Sexo"]),
        "data": data,
        "data_br": data_br,
        "local_origem": get(r, ["Localidade Origem", "local_origem", "Localidade_Origem", "Origem"]),
        "local_destino": get(r, ["Localidade Destino", "local_destino", "Localidade_Destino", "Destino"]),
        "peso": to_float(get(r, ["peso", "Peso", "PESO"])),
        "finalidade": get(r, ["Finalidade", "finalidade"])
    })

with open(ARQUIVO_JSON, "w", encoding="utf-8") as f:
    json.dump(dados, f, ensure_ascii=False)

print("JSON criado com sucesso!")
print("Registros exportados:", len(dados))
