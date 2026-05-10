
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

function localDestinoIgual(d, local){
  return normalizarTexto(d.local_destino) === local;
}

function localOrigemOuDestinoIgual(d, local){
  return normalizarTexto(d.local_origem) === local || normalizarTexto(d.local_destino) === local;
}

function media(arr){
  const v = arr.filter(x => x !== null && x !== undefined && !isNaN(x));
  return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
}

function getCampo(obj, nomes){
  for (const n of nomes){
    if (obj[n] !== undefined && obj[n] !== null && String(obj[n]).trim() !== "") return obj[n];
  }
  return "";
}

function atualizarListaLocalidades(){
  const dl = document.getElementById("listaLocalidades");
  if(!dl) return;

  const set = new Set();
  dados.forEach(d => {
    if(d.local_destino) set.add(d.local_destino);
  });

  dl.innerHTML = Array.from(set)
    .sort((a,b) => a.localeCompare(b))
    .map(l => `<option value="${l}"></option>`)
    .join("");
}

function iniciarApp(){
  const animais = new Set(dados.map(d => d.nome_usual));
  atualizarListaLocalidades();

  const st = document.getElementById("status");
  if(st) {
    st.innerHTML =
      `<b>Base carregada</b><br>` +
      `${dados.length.toLocaleString("pt-BR")} registros • ${animais.size.toLocaleString("pt-BR")} animais<br>` +
      `<small>Digite ou selecione uma localidade exata na lista.</small>`;
  }
}

function carregarCSV(){
  Papa.parse("dados.csv?v11localidadeexata=" + Date.now(), {
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

    // Animal atual na localidade: última movimentação com destino contendo a localidade pesquisada.
    if(!localDestinoIgual(ultima, local)) continue;

    const entradas = ordenado.filter(x => localDestinoIgual(x, local));
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
      destino: ultima.local_destino || entradaAtual.local_destino || "-"
    });
  }

  animaisAtuais.sort((a,b) => (b.entrada || 0) - (a.entrada || 0));

  const gruposMap = new Map();
  for(const a of animaisAtuais){
    const chave = a.destino || "SEM LOCALIDADE";
    if(!gruposMap.has(chave)) gruposMap.set(chave, []);
    gruposMap.get(chave).push(a);
  }

  const grupos = Array.from(gruposMap.entries()).map(([localidade, animais]) => {
    const entradaMaisRecente = animais.reduce((max, a) => !max || (a.entrada && a.entrada > max) ? a.entrada : max, null);
    return {
      localidade,
      quantidade: animais.length,
      entradaMaisRecente,
      gmdMedio: media(animais.map(x => x.gmd_global)),
      pesoMedio: media(animais.map(x => x.peso_atual)),
      permanenciaMedia: media(animais.map(x => x.permanencia_atual)),
      machos: animais.filter(x => x.sexo === "M" || x.sexo === "MACHO").length,
      femeas: animais.filter(x => x.sexo === "F" || x.sexo === "FEMEA" || x.sexo === "FÊMEA").length,
      animais
    };
  }).sort((a,b) => b.quantidade - a.quantidade || a.localidade.localeCompare(b.localidade));

  return {
    local,
    quantidade: animaisAtuais.length,
    gmdMedio: media(animaisAtuais.map(x => x.gmd_global)),
    pesoMedio: media(animaisAtuais.map(x => x.peso_atual)),
    permanenciaMedia: media(animaisAtuais.map(x => x.permanencia_atual)),
    entradaMaisRecente: animaisAtuais[0]?.entrada || null,
    animais: animaisAtuais,
    grupos
  };
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

function buscar(){
  const animal = animal6(document.getElementById("animal").value);
  const local = normalizarTexto(document.getElementById("local").value);

  if(!animal && !local){
    document.getElementById("status").innerText = "Digite o número do animal ou uma localidade.";
    return;
  }

  if(local && !animal){
    atualizarTelaLocalidadeAgrupada(resumoLocalidadeAtual(local));
    return;
  }

  const resultado = dados.filter(d => {
    if(animal && d.nome_usual !== animal) return false;
    if(local && !localOrigemOuDestinoIgual(d, local)) return false;
    return true;
  });

  atualizarTelaAnimal(resultado, animal);
}

function atualizarTelaLocalidadeAgrupada(resumo){
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
    if(timeline){ timeline.className = "timeline empty"; timeline.innerText = "Nenhum grupo encontrado nessa localidade."; }
    return;
  }

  if(status){
    status.innerHTML =
      `<b>${resumo.quantidade.toLocaleString("pt-BR")} animal(is) atualmente em ${resumo.local}</b><br>` +
      `${resumo.grupos.length.toLocaleString("pt-BR")} grupo(s) de localidade • ` +
      `Entrada mais recente: ${dataBR(resumo.entradaMaisRecente)} • ` +
      `GMD médio: ${fmt(resumo.gmdMedio, 2)} kg/dia`;
  }

  if(res){
    res.className = "result";
    res.innerHTML = `
      <div class="record summary">
        <div class="record-head">
          <span class="record-date">Resumo agrupado por localidade atual</span>
          <span class="weight">${resumo.quantidade.toLocaleString("pt-BR")} animais</span>
        </div>
        <p>Busca: <b>${resumo.local}</b></p>
        <p>Grupos encontrados: <b>${resumo.grupos.length.toLocaleString("pt-BR")}</b></p>
        <p>Entrada mais recente: <b>${dataBR(resumo.entradaMaisRecente)}</b></p>
        <p>GMD médio global: <b>${fmt(resumo.gmdMedio, 2)} kg/dia</b></p>
        <p>Peso médio atual: <b>${fmt(resumo.pesoMedio, 0)} kg</b></p>
        <p>Permanência média: <b>${fmt(resumo.permanenciaMedia, 0)} dias</b></p>
      </div>
      ${resumo.grupos.map(g => `
        <div class="record">
          <div class="record-head">
            <span class="record-date">${g.localidade}</span>
            <span class="weight">${g.quantidade.toLocaleString("pt-BR")} animais</span>
          </div>
          <p>Entrada mais recente: <b>${dataBR(g.entradaMaisRecente)}</b></p>
          <p>GMD médio: <b>${fmt(g.gmdMedio, 2)} kg/dia</b></p>
          <p>Peso médio: <b>${fmt(g.pesoMedio, 0)} kg</b></p>
          <p>Permanência média: <b>${fmt(g.permanenciaMedia, 0)} dias</b></p>
          <p>Sexo: <b>${g.machos} M</b> • <b>${g.femeas} F</b> • <b>${g.quantidade - g.machos - g.femeas} não informado/outros</b></p>
          <p>Animais: <b>${g.animais.slice(0, 35).map(x => x.animal).join(", ")}${g.animais.length > 35 ? "..." : ""}</b></p>
        </div>
      `).join("")}
    `;
  }

  // Timeline agrupada por localidade, não por animal.
  if(timeline){
    timeline.className = "timeline";
    timeline.innerHTML = resumo.grupos.map(g => `
      <div class="step">
        <div class="date">${dataBR(g.entradaMaisRecente)}</div>
        <div class="bubble">
          <div class="bubble-card">
            <strong>${g.localidade}</strong>
            <small>
              ${g.quantidade.toLocaleString("pt-BR")} animais
              • GMD médio: ${fmt(g.gmdMedio,2)} kg/dia
              • Peso médio: ${fmt(g.pesoMedio,0)} kg
              • Permanência: ${fmt(g.permanenciaMedia,0)} dias
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
