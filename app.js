let dados = [];

function somenteDigitos(v){
  return String(v ?? "").replace(/\D/g, "").trim();
}

function animal6(v){
  const s = somenteDigitos(v);
  return s ? s.padStart(6, "0") : "";
}

function normalizarTexto(v){
  return String(v ?? "").trim().toUpperCase().replace(/^NAN$/, "");
}

function numeroBR(v){
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function parseDate(v){
  if(!v) return null;
  const s = String(v).trim();

  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    return new Date(s + "T00:00:00");
  }

  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){
    const [d, m, y] = s.split("/");
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function dataBR(v){
  const d = parseDate(v);
  if(!d) return String(v ?? "");
  return d.toLocaleDateString("pt-BR");
}

function fmt(n, casas=2){
  if(n === null || n === undefined || isNaN(n)) return "-";
  return Number(n).toLocaleString("pt-BR", {
    maximumFractionDigits: casas,
    minimumFractionDigits: casas
  });
}

function diasEntre(a,b){
  if(!a || !b) return null;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function iniciarApp(){
  const animais = new Set(dados.map(d => d.nome_usual));
  document.getElementById("status").innerHTML =
    `<b>Base CSV carregada com sucesso</b><br>` +
    `V7 CSV — ${dados.length.toLocaleString("pt-BR")} registros<br>` +
    `${animais.size.toLocaleString("pt-BR")} animais`;
}

function carregarCSV(){
  Papa.parse("dados.csv?v7csvsexo", {
    download: true,
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    dynamicTyping: false,
    complete: function(results){
      dados = results.data.map(d => {
        const dataOriginal = d.Data_transferencia ?? d.data ?? d.data_br ?? "";
        return {
          nome_usual: animal6(d["Nome usual"] ?? d.nome_usual),
          sx: normalizarTexto(d.Sx ?? d.sx ?? d.SEXO ?? d.Sexo),
          data: String(dataOriginal ?? ""),
          data_br: dataBR(dataOriginal),
          data_obj: parseDate(dataOriginal),
          local_origem: normalizarTexto(d["Localidade Origem"] ?? d.local_origem),
          local_destino: normalizarTexto(d["Localidade Destino"] ?? d.local_destino),
          peso: numeroBR(d.peso ?? d.Peso),
          finalidade: normalizarTexto(d.Finalidade ?? d.finalidade)
        };
      })
      .filter(d => d.nome_usual)
      .sort((a,b) =>
        dsortAnimalData(a,b)
      );

      iniciarApp();
    },
    error: function(){
      document.getElementById("status").innerText = "Erro ao carregar dados.csv.";
    }
  });
}

function dsortAnimalData(a,b){
  if(a.nome_usual !== b.nome_usual){
    return a.nome_usual.localeCompare(b.nome_usual);
  }
  return (a.data_obj || 0) - (b.data_obj || 0);
}

function buscar(){
  const animal = animal6(document.getElementById("animal").value);
  const local = normalizarTexto(document.getElementById("local").value);

  if(!animal && !local){
    document.getElementById("status").innerText = "Digite o número do animal.";
    return;
  }

  const resultado = dados.filter(d => {
    if(animal && d.nome_usual !== animal) return false;
    if(local && !(d.local_origem.includes(local) || d.local_destino.includes(local))) return false;
    return true;
  });

  atualizarTela(resultado, animal);
}

function atualizarTela(lista, animalBuscado=""){
  const status = document.getElementById("status");
  const res = document.getElementById("resultado");
  const timeline = document.getElementById("timeline");

  document.getElementById("registros").innerText = lista.length.toLocaleString("pt-BR");

  if(lista.length === 0){
    status.innerText = animalBuscado
      ? `Animal ${animalBuscado} não encontrado na base carregada.`
      : "Nenhum registro encontrado.";

    res.className = "result empty";
    res.innerText = "Nenhum resultado.";

    timeline.className = "timeline empty";
    timeline.innerText = "Nenhum animal selecionado.";

    document.getElementById("gmd").innerText = "-";
    document.getElementById("dias").innerText = "-";
    document.getElementById("peso").innerText = "-";
    document.getElementById("sexo").innerText = "-";
    return;
  }

  const ordenado = [...lista].sort((a,b) => (a.data_obj || 0) - (b.data_obj || 0));
  const pesosValidos = ordenado.filter(x => x.peso > 0 && x.data_obj);
  const primeiroPeso = pesosValidos[0];
  const ultimoPeso = pesosValidos[pesosValidos.length - 1];

  let dias = null;
  let gmd = null;
  let pesoFinal = null;
  let sexoAnimal = "-";

  if(primeiroPeso && ultimoPeso){
    dias = diasEntre(primeiroPeso.data_obj, ultimoPeso.data_obj);
    pesoFinal = ultimoPeso.peso;

    if(dias && dias > 0){
      gmd = (ultimoPeso.peso - primeiroPeso.peso) / dias;
    }
  }

  const primeiroComSexo = ordenado.find(x => x.sx);
  sexoAnimal = primeiroComSexo ? primeiroComSexo.sx : "-";

  document.getElementById("gmd").innerText = gmd === null ? "-" : fmt(gmd, 2);
  document.getElementById("dias").innerText = dias === null ? "-" : dias.toLocaleString("pt-BR");
  document.getElementById("peso").innerText = pesoFinal === null ? "-" : fmt(pesoFinal, 0);
  document.getElementById("sexo").innerText = sexoAnimal;

  status.innerHTML =
    `<b>${lista.length.toLocaleString("pt-BR")} registro(s) encontrado(s)</b><br>` +
    `Animal ${ordenado[0].nome_usual}`;

  res.className = "result";
  res.innerHTML = ordenado.map(d => `
    <div class="record">
      <div class="record-head">
        <span class="record-date">${d.data_br || d.data || "-"}</span>
        <span class="weight">${d.peso || "-"} kg</span>
      </div>
      <p>Animal: <b>${d.nome_usual || "-"}</b></p>
      <p>Sexo: <b>${d.sx || "-"}</b></p>
      <p>Origem: <b>${d.local_origem || "-"}</b></p>
      <p>Destino: <b>${d.local_destino || "-"}</b></p>
      <p>Finalidade: <b>${d.finalidade || "-"}</b></p>
    </div>
  `).join("");

  timeline.className = "timeline";
  timeline.innerHTML = ordenado.map(d => `
    <div class="step">
      <div class="date">${d.data_br || d.data || "-"}</div>
      <div class="bubble">
        <div class="bubble-card">
          <strong>${d.local_origem || "-"} → ${d.local_destino || "-"}</strong>
          <small>
            Peso: ${d.peso || "-"} kg
            ${d.sx ? " • Sexo: " + d.sx : ""}
            ${d.finalidade ? " • Finalidade: " + d.finalidade : ""}
          </small>
        </div>
      </div>
    </div>
  `).join("");
}

function trajetoriaAnimal(){
  buscar();
  document.getElementById("timeline").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function limpar(){
  document.getElementById("animal").value = "";
  document.getElementById("local").value = "";
  atualizarTela([]);
}

carregarCSV();

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v7csvsexo");
  });
}
