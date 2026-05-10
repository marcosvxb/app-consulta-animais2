
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

function dataBR(v){
  const d = v instanceof Date ? v : parseDate(v);
  return d ? d.toLocaleDateString("pt-BR") : String(v ?? "");
}

function fmt(n, casas=2){
  if(n === null || n === undefined || isNaN(n)) return "-";
  return Number(n).toLocaleString("pt-BR", {
    maximumFractionDigits: casas,
    minimumFractionDigits: casas
  });
}

function diasEntre(a,b){ return (!a || !b) ? null : Math.round((b-a)/(1000*60*60*24)); }

function getCampo(obj, nomes){
  for (const n of nomes){
    if (obj[n] !== undefined && obj[n] !== null && String(obj[n]).trim() !== "") return obj[n];
  }
  return "";
}

function incluiLocalidade(d, local){
  return d.local_origem.includes(local) || d.local_destino.includes(local);
}

function iniciarApp(){
  const animais = new Set(dados.map(d => d.nome_usual));
  const st = document.getElementById("status");
  if(st) {
    st.innerHTML =
      `<b>Base carregada</b><br>` +
      `${dados.length.toLocaleString("pt-BR")} registros • ${animais.size.toLocaleString("pt-BR")} animais`;
  }
}

function carregarCSV(){
  Papa.parse("dados.csv?v9localidade=" + Date.now(), {
    download: true,
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    complete: function(results){
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
      })
      .filter(d => d.nome_usual)
      .sort((a,b) => a.nome_usual !== b.nome_usual ? a.nome_usual.localeCompare(b.nome_usual) : (a.data_obj || 0) - (b.data_obj || 0));

      iniciarApp();
    },
    error: function(err){
      console.error(err);
      const st = document.getElementById("status");
      if(st) st.innerText = "Erro ao carregar dados.csv.";
    }
  });
}

function agruparPorAnimal(lista){
  const map = new Map();
  for(const r of lista){
    if(!map.has(r.nome_usual)) map.set(r.nome_usual, []);
    map.get(r.nome_usual).push(r);
  }
  return map;
}

function resumoAnimalGlobal(regs){
  const pesos = regs.filter(x => x.peso > 0 && x.data_obj).sort((a,b) => a.data_obj - b.data_obj);
  const primeiro = pesos[0];
  const ultimo = pesos[pesos.length - 1];
  if(!primeiro || !ultimo) return {gmd:null, dias:null, pesoAtual: ultimo?.peso ?? null};
  const dias = diasEntre(primeiro.data_obj, ultimo.data_obj);
  const gmd = dias && dias > 0 ? (ultimo.peso - primeiro.peso) / dias : null;
  return {gmd, dias, pesoAtual: ultimo.peso};
}

function resumoLocalidadeAtual(local){
  const todosPorAnimal = agruparPorAnimal(dados);
  const hoje = new Date();
  const animaisAtuais = [];

  for(const [animal, regs] of todosPorAnimal.entries()){
    const ordenado = regs.filter(x => x.data_obj).sort((a,b) => a.data_obj - b.data_obj);
    if(!ordenado.length) continue;

    const ultima = ordenado[ordenado.length - 1];

    // Animal atual na localidade: a última movimentação dele tem destino igual/contendo a localidade buscada.
    if(!ultima.local_destino.includes(local)) continue;

    // Entrada mais recente na localidade atual: última linha cujo destino bate com a localidade.
    const entradas = ordenado.filter(x => x.local_destino.includes(local));
    const entradaAtual = entradas[entradas.length - 1] || ultima;

    const rg = resumoAnimalGlobal(ordenado);
    const permanenciaAtual = entradaAtual.data_obj ? diasEntre(entradaAtual.data_obj, hoje) : null;

    animaisAtuais.push({
      animal,
      sexo: (ordenado.find(x => x.sx) || {}).sx || "-",
      entrada: entradaAtual.data_obj,
      entrada_br: dataBR(entradaAtual.data_obj),
      peso_entrada: entradaAtual.peso || null,
      peso_atual: rg.pesoAtual,
      gmd_global: rg.gmd,
      dias_global: rg.dias,
      permanencia_atual: permanenciaAtual,
      finalidade: ultima.finalidade || "-",
      origem: entradaAtual.local_origem || "-",
      destino: entradaAtual.local_destino || "-"
    });
  }

  animaisAtuais.sort((a,b) => (b.entrada || 0) - (a.entrada || 0));

  const gmds = animaisAtuais.map(x => x.gmd_global).filter(x => x !== null && !isNaN(x));
  const pesos = animaisAtuais.map(x => x.peso_atual).filter(x => x !== null && !isNaN(x));
  const perms = animaisAtuais.map(x => x.permanencia_atual).filter(x => x !== null && !isNaN(x));
  const entradaMaisRecente = animaisAtuais[0]?.entrada || null;

  return {
    local,
    quantidade: animaisAtuais.length,
    gmdMedio: gmds.length ? gmds.reduce((a,b)=>a+b,0)/gmds.length : null,
    pesoMedio: pesos.length ? pesos.reduce((a,b)=>a+b,0)/pesos.length : null,
    permanenciaMedia: perms.length ? perms.reduce((a,b)=>a+b,0)/perms.length : null,
    entradaMaisRecente,
    animais: animaisAtuais
  };
}

function buscar(){
  const animal = animal6(document.getElementById("animal").value);
  const local = normalizarTexto(document.getElementById("local").value);

  if(!animal && !local){
    document.getElementById("status").innerText = "Digite o número do animal ou uma localidade.";
    return;
  }

  // Busca por localidade sem animal: mostra situação atual da localidade.
  if(local && !animal){
    const resumo = resumoLocalidadeAtual(local);
    atualizarTelaLocalidade(resumo);
    return;
  }

  const resultado = dados.filter(d => {
    if(animal && d.nome_usual !== animal) return false;
    if(local && !incluiLocalidade(d, local)) return false;
    return true;
  });

  atualizarTelaAnimal(resultado, animal);
}

function atualizarCardsBasicos({gmd=null, dias=null, peso=null, registros=0, sexo="-"}){
  const ids = {
    gmd: gmd === null ? "-" : fmt(gmd, 2),
    dias: dias === null ? "-" : Math.round(dias).toLocaleString("pt-BR"),
    peso: peso === null ? "-" : fmt(peso, 0),
    registros: registros.toLocaleString("pt-BR"),
    sexo: sexo || "-"
  };

  for(const [id, val] of Object.entries(ids)){
    const el = document.getElementById(id);
    if(el) el.innerText = val;
  }
}

function atualizarTelaLocalidade(resumo){
  const status = document.getElementById("status");
  const res = document.getElementById("resultado");
  const timeline = document.getElementById("timeline");

  atualizarCardsBasicos({
    gmd: resumo.gmdMedio,
    dias: resumo.permanenciaMedia,
    peso: resumo.pesoMedio,
    registros: resumo.quantidade,
    sexo: "M/F"
  });

  if(resumo.quantidade === 0){
    if(status) status.innerText = `Nenhum animal atual encontrado em ${resumo.local}.`;
    if(res){ res.className = "result empty"; res.innerText = "Nenhum resultado."; }
    if(timeline){ timeline.className = "timeline empty"; timeline.innerText = "Nenhum animal atual nessa localidade."; }
    return;
  }

  if(status){
    status.innerHTML =
      `<b>${resumo.quantidade.toLocaleString("pt-BR")} animal(is) atualmente em ${resumo.local}</b><br>` +
      `Entrada mais recente: ${dataBR(resumo.entradaMaisRecente)} • ` +
      `GMD médio: ${fmt(resumo.gmdMedio, 2)} kg/dia • ` +
      `Peso médio: ${fmt(resumo.pesoMedio, 0)} kg`;
  }

  if(res){
    res.className = "result";
    res.innerHTML = `
      <div class="record summary">
        <div class="record-head">
          <span class="record-date">Resumo atual da localidade</span>
          <span class="weight">${resumo.quantidade.toLocaleString("pt-BR")} animais</span>
        </div>
        <p>Localidade: <b>${resumo.local}</b></p>
        <p>Entrada mais recente: <b>${dataBR(resumo.entradaMaisRecente)}</b></p>
        <p>GMD médio global dos animais atuais: <b>${fmt(resumo.gmdMedio, 2)} kg/dia</b></p>
        <p>Peso médio atual: <b>${fmt(resumo.pesoMedio, 0)} kg</b></p>
        <p>Permanência média desde a entrada atual: <b>${fmt(resumo.permanenciaMedia, 0)} dias</b></p>
      </div>
      ${resumo.animais.slice(0, 300).map(a => `
        <div class="record">
          <div class="record-head">
            <span class="record-date">${a.animal}</span>
            <span class="weight">${a.peso_atual ? fmt(a.peso_atual,0) + " kg" : "-"}</span>
          </div>
          <p>Sexo: <b>${a.sexo}</b></p>
          <p>Entrada atual: <b>${a.entrada_br}</b></p>
          <p>Origem → Destino: <b>${a.origem} → ${a.destino}</b></p>
          <p>GMD global: <b>${a.gmd_global === null ? "-" : fmt(a.gmd_global,2) + " kg/dia"}</b></p>
          <p>Permanência atual: <b>${a.permanencia_atual === null ? "-" : a.permanencia_atual.toLocaleString("pt-BR") + " dias"}</b></p>
          <p>Finalidade: <b>${a.finalidade}</b></p>
        </div>
      `).join("")}
    `;
  }

  if(timeline){
    timeline.className = "timeline";
    timeline.innerHTML = resumo.animais.slice(0, 300).map(a => `
      <div class="step">
        <div class="date">${a.entrada_br}</div>
        <div class="bubble">
          <div class="bubble-card">
            <strong>${a.animal} • ${a.destino}</strong>
            <small>
              Peso atual: ${a.peso_atual ? fmt(a.peso_atual,0) + " kg" : "-"}
              • GMD: ${a.gmd_global === null ? "-" : fmt(a.gmd_global,2)}
              • ${a.permanencia_atual ?? "-"} dias
            </small>
          </div>
        </div>
      </div>
    `).join("");
  }
}

function atualizarTelaAnimal(lista, animalBuscado=""){
  const status = document.getElementById("status");
  const res = document.getElementById("resultado");
  const timeline = document.getElementById("timeline");

  if(lista.length === 0){
    if(status) status.innerText = animalBuscado ? `Animal ${animalBuscado} não encontrado na base carregada.` : "Nenhum registro encontrado.";
    if(res){ res.className = "result empty"; res.innerText = "Nenhum resultado."; }
    if(timeline){ timeline.className = "timeline empty"; timeline.innerText = "Nenhum animal selecionado."; }
    atualizarCardsBasicos({registros:0});
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
  atualizarCardsBasicos({gmd, dias, peso:pesoFinal, registros:lista.length, sexo:sexoAnimal});

  if(status){
    status.innerHTML = `<b>${lista.length.toLocaleString("pt-BR")} registro(s) encontrado(s)</b><br>Animal ${ordenado[0].nome_usual}`;
  }

  if(res){
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
  }

  if(timeline){
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
}

function trajetoriaAnimal(){
  buscar();
  const timeline = document.getElementById("timeline");
  if(timeline) timeline.scrollIntoView({behavior:"smooth", block:"start"});
}

function limpar(){
  document.getElementById("animal").value = "";
  document.getElementById("local").value = "";
  atualizarTelaAnimal([]);
}

if("serviceWorker" in navigator){
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}
carregarCSV();
