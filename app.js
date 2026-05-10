
let dados = [];

function somenteDigitos(v){ return String(v ?? "").replace(/\D/g, "").trim(); }
function animal6(v){ const s = somenteDigitos(v); return s ? s.padStart(6, "0") : ""; }
function normalizarTexto(v){ return String(v ?? "").trim().toUpperCase().replace(/^NAN$/, ""); }
function numeroBR(v){
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
function parseDate(v){
  if(!v) return null;
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.substring(0,10) + "T00:00:00");
  if(/^\d{2}\/\d{2}\/\d{4}/.test(s)){
    const [d,m,y] = s.substring(0,10).split("/");
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function dataBR(v){ const d = parseDate(v); return d ? d.toLocaleDateString("pt-BR") : String(v ?? ""); }
function fmt(n, casas=2){
  if(n === null || n === undefined || isNaN(n)) return "-";
  return Number(n).toLocaleString("pt-BR", {maximumFractionDigits: casas, minimumFractionDigits: casas});
}
function diasEntre(a,b){ return (!a || !b) ? null : Math.round((b-a)/(1000*60*60*24)); }
function getCampo(obj, nomes){
  for (const n of nomes){
    if (obj[n] !== undefined && obj[n] !== null && String(obj[n]).trim() !== "") return obj[n];
  }
  return "";
}
function iniciarApp(){
  const animais = new Set(dados.map(d => d.nome_usual));
  const st = document.getElementById("status");
  if(st) st.innerHTML = `<b>Base CSV carregada com sucesso</b><br>V8 CSV — ${dados.length.toLocaleString("pt-BR")} registros<br>${animais.size.toLocaleString("pt-BR")} animais`;
}
function carregarCSV(){
  Papa.parse("dados.csv?v8csv=" + Date.now(), {
    download: true,
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    complete: function(results){
      console.log("CSV meta:", results.meta);
      console.log("Primeira linha:", results.data?.[0]);
      dados = results.data.map(d => {
        const dataOriginal = getCampo(d, ["Data_transferencia","data","data_br","Data","DATA"]);
        return {
          nome_usual: animal6(getCampo(d, ["Nome usual","nome_usual","Animal","animal"])),
          sx: normalizarTexto(getCampo(d, ["Sx","sx","SEXO","Sexo","sexo"])),
          data: String(dataOriginal ?? ""),
          data_br: dataBR(dataOriginal),
          data_obj: parseDate(dataOriginal),
          local_origem: normalizarTexto(getCampo(d, ["Localidade Origem","local_origem","Origem","origem"])),
          local_destino: normalizarTexto(getCampo(d, ["Localidade Destino","local_destino","Destino","destino"])),
          peso: numeroBR(getCampo(d, ["peso","Peso","PESO"])),
          finalidade: normalizarTexto(getCampo(d, ["Finalidade","finalidade","FINALIDADE"]))
        };
      }).filter(d => d.nome_usual).sort((a,b) => a.nome_usual !== b.nome_usual ? a.nome_usual.localeCompare(b.nome_usual) : (a.data_obj || 0) - (b.data_obj || 0));
      iniciarApp();
    },
    error: function(err){
      console.error(err);
      const st = document.getElementById("status");
      if(st) st.innerText = "Erro ao carregar dados.csv.";
    }
  });
}
function buscar(){
  const animal = animal6(document.getElementById("animal").value);
  const local = normalizarTexto(document.getElementById("local").value);
  if(!animal && !local){
    document.getElementById("status").innerText = "Digite o número do animal ou uma localidade.";
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
  const st = document.getElementById("status");
  const res = document.getElementById("resultado");
  const timeline = document.getElementById("timeline");
  const reg = document.getElementById("registros");
  if(reg) reg.innerText = lista.length.toLocaleString("pt-BR");
  if(lista.length === 0){
    if(st) st.innerText = animalBuscado ? `Animal ${animalBuscado} não encontrado na base carregada.` : "Nenhum registro encontrado.";
    if(res){ res.className = "result empty"; res.innerText = "Nenhum resultado."; }
    if(timeline){ timeline.className = "timeline empty"; timeline.innerText = "Nenhum animal selecionado."; }
    ["gmd","dias","peso","sexo"].forEach(id => { const el = document.getElementById(id); if(el) el.innerText = "-"; });
    return;
  }
  const ordenado = [...lista].sort((a,b) => (a.data_obj || 0) - (b.data_obj || 0));
  const pesosValidos = ordenado.filter(x => x.peso > 0 && x.data_obj);
  const primeiroPeso = pesosValidos[0];
  const ultimoPeso = pesosValidos[pesosValidos.length - 1];
  let dias = null, gmd = null, pesoFinal = null;
  if(primeiroPeso && ultimoPeso){
    dias = diasEntre(primeiroPeso.data_obj, ultimoPeso.data_obj);
    pesoFinal = ultimoPeso.peso;
    if(dias && dias > 0) gmd = (ultimoPeso.peso - primeiroPeso.peso) / dias;
  }
  const sexoAnimal = (ordenado.find(x => x.sx) || {}).sx || "-";
  document.getElementById("gmd").innerText = gmd === null ? "-" : fmt(gmd, 2);
  document.getElementById("dias").innerText = dias === null ? "-" : dias.toLocaleString("pt-BR");
  document.getElementById("peso").innerText = pesoFinal === null ? "-" : fmt(pesoFinal, 0);
  document.getElementById("sexo").innerText = sexoAnimal;
  if(st) st.innerHTML = `<b>${lista.length.toLocaleString("pt-BR")} registro(s) encontrado(s)</b><br>Animal ${ordenado[0].nome_usual}`;
  if(res){
    res.className = "result";
    res.innerHTML = ordenado.map(d => `<div class="record"><div class="record-head"><span class="record-date">${d.data_br || d.data || "-"}</span><span class="weight">${d.peso || "-"} kg</span></div><p>Animal: <b>${d.nome_usual || "-"}</b></p><p>Sexo: <b>${d.sx || "-"}</b></p><p>Origem: <b>${d.local_origem || "-"}</b></p><p>Destino: <b>${d.local_destino || "-"}</b></p><p>Finalidade: <b>${d.finalidade || "-"}</b></p></div>`).join("");
  }
  if(timeline){
    timeline.className = "timeline";
    timeline.innerHTML = ordenado.map(d => `<div class="step"><div class="date">${d.data_br || d.data || "-"}</div><div class="bubble"><div class="bubble-card"><strong>${d.local_origem || "-"} → ${d.local_destino || "-"}</strong><small>Peso: ${d.peso || "-"} kg${d.sx ? " • Sexo: " + d.sx : ""}${d.finalidade ? " • Finalidade: " + d.finalidade : ""}</small></div></div></div>`).join("");
  }
}
function trajetoriaAnimal(){
  buscar();
  const t = document.getElementById("timeline");
  if(t) t.scrollIntoView({behavior:"smooth", block:"start"});
}
function limpar(){
  document.getElementById("animal").value = "";
  document.getElementById("local").value = "";
  atualizarTela([]);
}
if("serviceWorker" in navigator){
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}
carregarCSV();
