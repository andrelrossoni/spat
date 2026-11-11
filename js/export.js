/* ===== Exportação de relatórios: Excel (.xlsx com gráficos nativos) e PowerPoint (.pptx) =====
   Recebe o objeto R montado por dadosRelatorio() no núcleo. Retorna Uint8Array. */
const Export = (()=>{
  const LIBS = {jszip:"https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",pptx:"https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"};
  const load = src => new Promise((ok,err)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=()=>err(new Error("Não foi possível carregar a biblioteca de exportação."));document.head.appendChild(s)});
  async function prep(k){ if(k==="jszip"&&!window.JSZip) await load(LIBS.jszip); if(k==="pptx"&&!window.PptxGenJS) await load(LIBS.pptx); }
  const COR={azul:"29428C",verde:"00783E",verdeClaro:"7CCF9F",cinza:"A7B4B2",ink:"17233B",muted:"566377",fundo:"F2F5F4",linha:"D8E0DE",verm:"B0281F",laranja:"C9820F",azulClaro:"8FA6DD"};
  const b64 = uri => uri.split(",")[1];
  const x = s => String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"");

  /* ---------------- XLSX (OOXML escrito à mão) ---------------- */
  const colL = n => {let s="";n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s};
  const ref = (c,r) => colL(c)+(r+1);
  const serial = v => {const d=new Date(v);return Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1899,11,30))/864e5)};
  // estilos (índices de cellXfs)
  const ST={def:0,titulo:1,sub:2,cab:3,txt:4,int:5,pct:6,data:7,secao:8,kpiV:9,kpiL:10,totInt:11,totTxt:12,ok:13,bad:14,warn:15,wrap:16,gDone:17,gPlan:18,gFut:19,gAtr:20,gHoje:21,gCab:22,gVazio:23,info:24,kpiPct:25};
  const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0%"/></numFmts>
<fonts count="11">
<font><sz val="10"/><color rgb="FF17233B"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="18"/><color rgb="FF29428C"/><name val="Arial"/><family val="2"/></font>
<font><sz val="10"/><color rgb="FF566377"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="12"/><color rgb="FF29428C"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="22"/><color rgb="FF00783E"/><name val="Arial"/><family val="2"/></font>
<font><sz val="9"/><color rgb="FF566377"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FF17233B"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FF00783E"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FFB0281F"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FFC9820F"/><name val="Arial"/><family val="2"/></font>
</fonts>
<fills count="11">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF00783E"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F5F4"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE4EFE9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF00783E"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF8FA6DD"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="lightUp"><fgColor rgb="FF8FA6DD"/><bgColor rgb="FFFFFFFF"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE0675E"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFBF0DC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF29428C"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="4">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD8E0DE"/></left><right style="thin"><color rgb="FFD8E0DE"/></right><top style="thin"><color rgb="FFD8E0DE"/></top><bottom style="thin"><color rgb="FFD8E0DE"/></bottom><diagonal/></border>
<border><left/><right/><top/><bottom style="medium"><color rgb="FF00783E"/></bottom><diagonal/></border>
<border><left/><right style="thin"><color rgb="FFEDF1F0"/></right><top/><bottom style="thin"><color rgb="FFEDF1F0"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="26">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="1" fontId="5" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
<xf numFmtId="1" fontId="7" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="8" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="9" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="10" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="3" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="6" borderId="3" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="7" borderId="3" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="8" borderId="3" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="9" borderId="3" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" textRotation="90"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="3" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="165" fontId="5" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function cellXml(c,r,cell){
    if(cell==null) return "";
    const o = typeof cell==="object" && !(cell instanceof Date) ? cell : {v:cell};
    const s = o.s!=null?` s="${o.s}"`:"";
    const a = ref(c,r);
    if(o.v==null||o.v==="") return o.s!=null?`<c r="${a}"${s}/>`:"";
    if(typeof o.v==="number") return Number.isFinite(o.v)?`<c r="${a}"${s}><v>${o.v}</v></c>`:`<c r="${a}"${s}/>`;
    return `<c r="${a}"${s} t="inlineStr"><is><t xml:space="preserve">${x(o.v)}</t></is></c>`;
  }
  function sheetXml(sh){
    const rows=sh.rows.map((row,r)=>{if(!row)return "";const ht=sh.alturas&&sh.alturas[r]?` ht="${sh.alturas[r]}" customHeight="1"`:"";
      const cells=row.map((cell,c)=>cellXml(c,r,cell)).join("");return `<row r="${r+1}"${ht}>${cells}</row>`}).join("");
    const cols=sh.cols?`<cols>${sh.cols.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols>`:"";
    const pane=sh.congelar?`<pane ${sh.congelar.c?`xSplit="${sh.congelar.c}" `:""}ySplit="${sh.congelar.r}" topLeftCell="${ref(sh.congelar.c||0,sh.congelar.r)}" activePane="bottomRight" state="frozen"/>`:"";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"${sh.primeira?' tabSelected="1"':""}>${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${sh.filtro?`<autoFilter ref="${sh.filtro}"/>`:""}${sh.merges&&sh.merges.length?`<mergeCells count="${sh.merges.length}">${sh.merges.map(m=>`<mergeCell ref="${m}"/>`).join("")}</mergeCells>`:""}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>${sh.desenho?`<drawing r:id="rId1"/>`:""}</worksheet>`;
  }
  const rich=(t,sz,cor,b)=>`<c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b?1:0}"><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:r><a:rPr lang="pt-BR" sz="${sz}" b="${b?1:0}"><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${x(t)}</a:t></a:r></a:p></c:rich>`;
  const txPr=(sz,cor)=>`<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}"><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>`;
  function chartXml(o){
    const strCache=v=>`<c:strCache><c:ptCount val="${v.length}"/>${v.map((s,i)=>`<c:pt idx="${i}"><c:v>${x(s)}</c:v></c:pt>`).join("")}</c:strCache>`;
    const numCache=(v,fmt)=>`<c:numCache><c:formatCode>${fmt}</c:formatCode><c:ptCount val="${v.length}"/>${v.map((n,i)=>n==null?"":`<c:pt idx="${i}"><c:v>${n}</c:v></c:pt>`).join("")}</c:numCache>`;
    const fmt=o.pct?"0%":"0";
    const lbl=`<c:dLbls><c:numFmt formatCode="${fmt}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900,COR.ink)}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`;
    const line=o.tipo==="line";
    const sers=o.series.map((s,i)=>`<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:strRef><c:f>${s.nomeRef}</c:f>${strCache([s.nome])}</c:strRef></c:tx>`+
      (line?`<c:spPr><a:ln w="31750" cap="rnd"><a:solidFill><a:srgbClr val="${s.cor}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${s.cor}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:marker>`
        :`<c:spPr><a:solidFill><a:srgbClr val="${s.cor}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:invertIfNegative val="0"/>`)+
      (o.rotulos!==false?lbl:"")+
      `<c:cat><c:strRef><c:f>${o.catRef}</c:f>${strCache(o.cats)}</c:strRef></c:cat><c:val><c:numRef><c:f>${s.ref}</c:f>${numCache(s.vals,fmt)}</c:numRef></c:val>${line?'<c:smooth val="0"/>':""}</c:ser>`).join("");
    const horiz=o.tipo==="bar";
    const grupo=line?`<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/><c:axId val="501"/><c:axId val="502"/></c:lineChart>`
      :`<c:barChart><c:barDir val="${horiz?"bar":"col"}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="${o.gap||70}"/><c:overlap val="${o.series.length>1?-8:0}"/><c:axId val="501"/><c:axId val="502"/></c:barChart>`;
    const eixoLinha=`<c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="${COR.linha}"/></a:solidFill></a:ln></c:spPr>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:lang val="pt-BR"/><c:roundedCorners val="0"/>
<c:chart><c:title><c:tx>${rich(o.titulo,1200,COR.azul,true)}</c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${grupo}
<c:catAx><c:axId val="501"/><c:scaling><c:orientation val="${horiz?"maxMin":"minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${horiz?"l":"b"}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${eixoLinha}${txPr(900,COR.muted)}<c:crossAx val="502"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>
<c:valAx><c:axId val="502"/><c:scaling><c:orientation val="minMax"/>${o.pct?'<c:max val="1"/>':""}<c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="${horiz?"b":"l"}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E6EBE9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${fmt}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900,COR.muted)}<c:crossAx val="501"/><c:crosses val="${horiz?"max":"autoZero"}"/><c:crossBetween val="between"/></c:valAx>
<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${o.series.length>1?`<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${txPr(900,COR.ink)}</c:legend>`:""}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${COR.linha}"/></a:solidFill></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr></c:chartSpace>`;
  }
  const anc=(p)=>`<xdr:from><xdr:col>${p[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${p[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${p[2]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${p[3]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`;
  function drawingXml(itens){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">${itens.map((it,i)=>it.img
      ?`<xdr:oneCellAnchor><xdr:from><xdr:col>${it.pos[0]}</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>${it.pos[1]}</xdr:row><xdr:rowOff>57150</xdr:rowOff></xdr:from><xdr:ext cx="${it.cx}" cy="${it.cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i+2}" name="Marca Embrapa"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${it.cx}" cy="${it.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`
      :`<xdr:twoCellAnchor editAs="oneCell">${anc(it.pos)}<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i+2}" name="Gráfico ${i+1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId${i+1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join("")}</xdr:wsDr>`;
  }
  const qs = n => `'${n.replace(/'/g,"''")}'`;
  const cabecalhoPlanilha=(R,titulo,ncols)=>({rows:[[null,null,{v:titulo,s:ST.titulo}],[null,null,{v:"Embrapa Agrossilvipastoril · Setor de Prospecção e Avaliação de Tecnologias (SPAT)",s:ST.sub}],[null,null,{v:`Período: ${R.per.rotulo} · Gerado em ${R.geradoEm}`,s:ST.sub}],null],merges:[`C1:${colL(Math.max(ncols-1,5))}1`],alturas:{0:30}});

  async function xlsx(R){
    await prep("jszip");
    const sheets=[]; // {nome, rows, cols, merges, filtro, congelar, itens:[{img}|{chart}]}
    const logo={img:true,pos:[0,0],cx:1450000,cy:Math.round(1450000/MARCA.proporcao)};
    /* 1. Resumo */
    {const h=cabecalhoPlanilha(R,"Indicadores do SPAT",10); const rows=h.rows; const nome="Resumo";
     rows[4]=[{v:"Visão geral do período",s:ST.secao}];
     const k=[["Demandas recebidas",R.tot.rec],["Entregas concluídas",R.tot.con],["Concluídas no prazo",R.tot.prazo==null?null:R.tot.prazo/100],["Em andamento hoje",R.tot.and],["Atrasadas hoje",R.tot.atr],["Canceladas no período",R.tot.can]];
     rows[5]=[];rows[6]=[];const merges=[...h.merges];
     k.forEach(([l,v],i)=>{const c=i===0?0:i*2-1;rows[5][c]={v,s:i===2?ST.kpiPct:ST.kpiV};rows[6][c]={v:l,s:ST.kpiL};if(i>0&&i<5){rows[5][c+1]={s:ST.kpiV};rows[6][c+1]={s:ST.kpiL};merges.push(`${ref(c,5)}:${ref(c+1,5)}`,`${ref(c,6)}:${ref(c+1,6)}`)}});
     rows[8]=[{v:"Indicadores por dimensão de atuação",s:ST.secao}];
     rows[9]=["Dimensão","Recebidas","Concluídas","Canceladas","Em andamento","Atrasadas","% no prazo","Tempo médio (d.u.)","Meta anual","% da meta"].map(v=>({v,s:ST.cab}));
     R.dims.forEach((x,i)=>{rows[10+i]=[{v:`${x.d.n==="·"?"":x.d.n+". "}${x.d.curto}`,s:ST.txt},{v:x.rec.length,s:ST.int},{v:x.con.length,s:ST.int},{v:x.can.length,s:ST.int},{v:x.and.length,s:ST.int},{v:x.atr,s:ST.int},{v:x.prazo==null?null:x.prazo/100,s:ST.pct},{v:x.tempo,s:ST.int},{v:x.meta||null,s:ST.int},{v:x.meta?x.conAno/x.meta:null,s:ST.pct}]});
     const tr=10+R.dims.length; const n=R.dims.length;
     rows[tr]=[{v:"Total",s:ST.totTxt},{v:R.tot.rec,s:ST.totInt},{v:R.tot.con,s:ST.totInt},{v:R.tot.can,s:ST.totInt},{v:R.tot.and,s:ST.totInt},{v:R.tot.atr,s:ST.totInt},{v:R.tot.prazo==null?null:R.tot.prazo/100,s:ST.pct},{v:R.tot.tempo,s:ST.totInt},{v:null,s:ST.totInt},{v:null,s:ST.totInt}];
     rows[tr+1]=[{v:"Recebidas e concluídas pela data de abertura e de conclusão no período; em andamento e atrasadas na posição de hoje. Canceladas pela data do cancelamento. Demandas excluídas não entram.",s:ST.sub}];
     const cats=R.dims.map(x=>x.d.curto), catRef=`${qs(nome)}!$A$11:$A$${10+n}`;
     sheets.push({nome,rows,merges,alturas:{...h.alturas,5:34,6:30,9:30},cols:[30,13,13,13,13,13,13,13,13,13],primeira:true,itens:[logo,
       {chart:chartXml({tipo:"col",titulo:"Demandas recebidas, concluídas e canceladas por dimensão",cats,catRef,series:[{nome:"Recebidas",nomeRef:`${qs(nome)}!$B$10`,ref:`${qs(nome)}!$B$11:$B$${10+n}`,vals:R.dims.map(x=>x.rec.length),cor:COR.azul},{nome:"Concluídas",nomeRef:`${qs(nome)}!$C$10`,ref:`${qs(nome)}!$C$11:$C$${10+n}`,vals:R.dims.map(x=>x.con.length),cor:COR.verde},{nome:"Canceladas",nomeRef:`${qs(nome)}!$D$10`,ref:`${qs(nome)}!$D$11:$D$${10+n}`,vals:R.dims.map(x=>x.can.length),cor:COR.cinza}]}),pos:[0,tr+3,5,tr+23]},
       {chart:chartXml({tipo:"bar",titulo:"Concluídas no prazo por dimensão",pct:true,cats,catRef,series:[{nome:"% no prazo",nomeRef:`${qs(nome)}!$G$10`,ref:`${qs(nome)}!$G$11:$G$${10+n}`,vals:R.dims.map(x=>x.prazo==null?null:x.prazo/100),cor:COR.verde}]}),pos:[5,tr+3,10,tr+23]}]});
    }
    /* 2. Por serviço */
    {const h=cabecalhoPlanilha(R,"Entregas por serviço",8);const rows=h.rows;const nome="Por serviço";
     rows[4]=["Dimensão","Serviço","Indicador de entrega","Recebidas","Concluídas","Canceladas","Em andamento","Prazo de ref. (d.u.)"].map(v=>({v,s:ST.cab}));
     R.servicos.forEach((s,i)=>{rows[5+i]=[{v:s.dim,s:ST.txt},{v:s.nome,s:ST.txt},{v:s.ind,s:ST.txt},{v:s.rec,s:ST.int},{v:s.con,s:ST.int},{v:s.can,s:ST.int},{v:s.and,s:ST.int},{v:s.sla,s:ST.int}]});
     const n=R.servicos.length;
     sheets.push({nome,rows,merges:h.merges,alturas:{...h.alturas,4:30},cols:[24,40,36,12,12,12,13,14],filtro:`A5:H${5+n}`,congelar:{r:5},itens:[logo,
       {chart:chartXml({tipo:"bar",titulo:"Entregas concluídas por serviço no período",gap:40,cats:R.servicos.map(s=>s.ind),catRef:`${qs(nome)}!$C$6:$C$${5+n}`,series:[{nome:"Concluídas",nomeRef:`${qs(nome)}!$E$5`,ref:`${qs(nome)}!$E$6:$E$${5+n}`,vals:R.servicos.map(s=>s.con),cor:COR.verde}]}),pos:[9,4,18,5+n+2]}]});
    }
    /* 3. Evolução mensal */
    {const h=cabecalhoPlanilha(R,"Evolução mensal",6);const rows=h.rows;const nome="Evolução mensal";
     rows[4]=["Mês","Recebidas","Concluídas","Canceladas","Concluídas acumuladas"].map(v=>({v,s:ST.cab}));
     let ac=0;R.mensal.forEach((m,i)=>{ac+=m.con;rows[5+i]=[{v:m.rotulo,s:ST.txt},{v:m.rec,s:ST.int},{v:m.con,s:ST.int},{v:m.can,s:ST.int},{v:ac,s:ST.int}]});
     const n=R.mensal.length,cats=R.mensal.map(m=>m.rotulo),catRef=`${qs(nome)}!$A$6:$A$${5+n}`;
     sheets.push({nome,rows,merges:h.merges,alturas:{...h.alturas,4:30},cols:[16,13,13,13,16],itens:[logo,
       {chart:chartXml({tipo:"col",titulo:"Recebidas, concluídas e canceladas por mês",cats,catRef,series:[{nome:"Recebidas",nomeRef:`${qs(nome)}!$B$5`,ref:`${qs(nome)}!$B$6:$B$${5+n}`,vals:R.mensal.map(m=>m.rec),cor:COR.azul},{nome:"Concluídas",nomeRef:`${qs(nome)}!$C$5`,ref:`${qs(nome)}!$C$6:$C$${5+n}`,vals:R.mensal.map(m=>m.con),cor:COR.verde},{nome:"Canceladas",nomeRef:`${qs(nome)}!$D$5`,ref:`${qs(nome)}!$D$6:$D$${5+n}`,vals:R.mensal.map(m=>m.can),cor:COR.cinza}]}),pos:[6,4,15,22]},
       {chart:chartXml({tipo:"line",titulo:"Entregas concluídas acumuladas",cats,catRef,series:[{nome:"Acumulado",nomeRef:`${qs(nome)}!$E$5`,ref:`${qs(nome)}!$E$6:$E$${5+n}`,vals:R.mensal.reduce((a,m)=>{a.push((a.at(-1)||0)+m.con);return a},[]),cor:COR.verde}]}),pos:[6,23,15,41]}]});
    }
    /* 4. Cronograma (Gantt semanal) */
    {const nome="Cronograma";const G=R.gantt;const sem=G.semanas;const c0=6;
     const rows=[[null,null,{v:"Cronograma das ações do SPAT",s:ST.titulo}],[null,null,{v:"Barras semanais: verde = executado · azul = planejado até a previsão · hachurado = ação planejada ainda não iniciada · vermelho = atraso · coluna amarela = semana atual",s:ST.sub}],[null,null,{v:`Período: ${G.rotulo} · Gerado em ${R.geradoEm}`,s:ST.sub}],null];
     rows[4]=["Código","Demanda","Dimensão","Responsável","Início","Previsão"].map(v=>({v,s:ST.cab})).concat(sem.map(w=>({v:w.rotulo,s:ST.gCab})));
     G.itens.forEach((it,i)=>{const r=[{v:it.cod,s:ST.txt},{v:it.titulo,s:ST.txt},{v:it.dim,s:ST.txt},{v:it.resp,s:ST.txt},{v:serial(it.ini),s:ST.data},{v:serial(it.prev),s:ST.data}];
       sem.forEach(w=>{let s=w.hoje?ST.gHoje:ST.gVazio;const a=w.ini,b=w.fim;const sob=(p,q)=>p<b&&q>a;
         if(it.planejada&&sob(it.ini,it.prev)) s=ST.gFut;
         else{ if(sob(it.ini,it.feitoAte)) s=ST.gDone; else if(sob(it.feitoAte,it.prev)&&!it.concluida) s=ST.gPlan; if(it.atrasoAte&&sob(it.prev,it.atrasoAte)) s=ST.gAtr; }
         r.push({s})});rows[5+i]=r});
     sheets.push({nome,rows,merges:[`C1:N1`],alturas:{0:30,4:52},cols:[16,46,22,20,11,11].concat(sem.map(()=>3.2)),congelar:{r:5,c:c0},filtro:G.itens.length?`A5:F${5+G.itens.length}`:null,itens:[]});
    }
    /* 5. Demandas */
    {const nome="Demandas";const rows=[[{v:"Demandas do período",s:ST.titulo}],[{v:`Abertas, concluídas ou canceladas no período e todas em andamento · ${R.per.rotulo}`,s:ST.sub}],null];
     const cab=["Código","Dimensão","Serviço","Título","Origem","Solicitante","Unidade","Parceiro","Responsável","Situação","Etapa atual","Aberta em","Previsão","Concluída em","Dias úteis","Motivo do cancelamento"];
     rows[3]=cab.map(v=>({v,s:ST.cab}));
     R.lista.forEach((d,i)=>{const sk={ok:ST.ok,bad:ST.bad,warn:ST.warn,info:ST.info,mut:ST.txt}[d.sitK]||ST.txt;
       rows[4+i]=[{v:d.cod,s:ST.txt},{v:d.dim,s:ST.txt},{v:d.servico,s:ST.txt},{v:d.titulo,s:ST.wrap},{v:d.origem,s:ST.txt},{v:d.solicitante,s:ST.txt},{v:d.unidade,s:ST.txt},{v:d.parceiro,s:ST.txt},{v:d.responsavel,s:ST.txt},{v:d.situacao,s:sk},{v:d.etapa,s:ST.txt},{v:serial(d.criadoEm),s:ST.data},{v:serial(d.prazo),s:ST.data},{v:d.concluidaEm?serial(d.concluidaEm):null,s:ST.data},{v:d.du,s:ST.int},{v:d.motivo,s:ST.wrap}]});
     sheets.push({nome,rows,cols:[15,22,34,44,12,22,24,24,22,20,28,12,12,13,10,40],filtro:`A4:P${4+R.lista.length}`,congelar:{r:4,c:1},alturas:{0:26,3:30},itens:[]});
    }
    /* 6. Impactos */
    {const nome="Carteira de impactos";const rows=[[{v:"Carteira de impactos",s:ST.titulo}],[{v:"Ativos em ciclos de avaliação, monitoramentos de adoção e estudos de impacto",s:ST.sub}],null];
     rows[3]=["Ativo","Modo","Ciclo ou estudo","Código","Etapa atual","Situação","Previsão"].map(v=>({v,s:ST.cab}));
     R.ativos.forEach((a,i)=>{rows[4+i]=[{v:a.nome,s:ST.wrap},{v:a.modo,s:a.modo==="Avaliação"?ST.ok:ST.info},{v:a.ciclo,s:ST.wrap},{v:a.cod,s:ST.txt},{v:a.etapa,s:ST.txt},{v:a.situacao,s:ST.txt},{v:serial(a.prazo),s:ST.data}]});
     if(!R.ativos.length) rows[4]=[{v:"Nenhum ativo na carteira de impactos no período.",s:ST.sub}];
     sheets.push({nome,rows,cols:[44,16,40,15,28,20,12],filtro:R.ativos.length?`A4:G${4+R.ativos.length}`:null,alturas:{0:26,3:30},itens:[]});
    }
    /* ---- montagem do pacote ---- */
    const z=new JSZip(); let nChart=0,nImg=0;
    const ctOver=[]; const wbRels=[];
    sheets.forEach((sh,i)=>{
      const si=i+1; sh.desenho=sh.itens.length>0;
      z.file(`xl/worksheets/sheet${si}.xml`,sheetXml(sh)); ctOver.push(`<Override PartName="/xl/worksheets/sheet${si}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
      wbRels.push(`<Relationship Id="rId${si}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${si}.xml"/>`);
      if(sh.desenho){
        z.file(`xl/worksheets/_rels/sheet${si}.xml.rels`,`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${si}.xml"/></Relationships>`);
        const rels=sh.itens.map((it,j)=>{ if(it.img){nImg++;z.file(`xl/media/image${nImg}.png`,b64(MARCA.cor),{base64:true});return `<Relationship Id="rId${j+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${nImg}.png"/>`}
          nChart++; z.file(`xl/charts/chart${nChart}.xml`,it.chart); ctOver.push(`<Override PartName="/xl/charts/chart${nChart}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
          return `<Relationship Id="rId${j+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${nChart}.xml"/>`});
        z.file(`xl/drawings/drawing${si}.xml`,drawingXml(sh.itens)); ctOver.push(`<Override PartName="/xl/drawings/drawing${si}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
        z.file(`xl/drawings/_rels/drawing${si}.xml.rels`,`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`);
      }
    });
    const n=sheets.length;
    wbRels.push(`<Relationship Id="rId${n+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
    const defs=sheets.map((sh,i)=>sh.filtro?`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${qs(sh.nome)}!${sh.filtro.replace(/([A-Z]+)(\d+)/g,"$$$1$$$2")}</definedName>`:"").join("");
    z.file("xl/workbook.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((sh,i)=>`<sheet name="${x(sh.nome)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets>${defs?`<definedNames>${defs}</definedNames>`:""}<calcPr calcId="191029"/></workbook>`);
    z.file("xl/_rels/workbook.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join("")}</Relationships>`);
    z.file("xl/styles.xml",STYLES);
    z.file("_rels/.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
    const agora=new Date().toISOString().replace(/\.\d+Z$/,"Z");
    z.file("docProps/core.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Indicadores do SPAT · ${x(R.per.rotulo)}</dc:title><dc:creator>Sistema de Gestão do SPAT · Embrapa Agrossilvipastoril</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created></cp:coreProperties>`);
    z.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${ctOver.join("")}</Types>`);
    return z.generateAsync({type:"uint8array",compression:"DEFLATE"});
  }

  /* ---------------- PPTX (PptxGenJS) ---------------- */
  async function pptx(R){
    await prep("pptx");
    const p=new PptxGenJS(); p.layout="LAYOUT_WIDE"; p.author="SPAT · Embrapa Agrossilvipastoril"; p.title=`Indicadores do SPAT · ${R.per.rotulo}`;
    const F="Arial", W=13.333;
    const lw=1.55, lh=lw/MARCA.proporcao;
    p.defineSlideMaster({title:"SPAT",background:{color:"FFFFFF"},objects:[
      {rect:{x:0,y:7.1,w:W,h:0.4,fill:{color:COR.fundo}}},
      {rect:{x:0,y:7.08,w:W,h:0.03,fill:{color:COR.verde}}},
      {text:{text:`SPAT · Embrapa Agrossilvipastoril · ${R.per.rotulo}`,options:{x:0.5,y:7.13,w:8,h:0.32,fontFace:F,fontSize:10,color:COR.muted}}},
      {image:{data:MARCA.cor,x:W-0.5-lw,y:0.32,w:lw,h:lh}}],
      slideNumber:{x:W-1.0,y:7.13,w:0.5,h:0.32,fontFace:F,fontSize:10,color:COR.muted,align:"right"}});
    const titulo=(s,t,sub)=>{s.addText(t,{x:0.5,y:0.3,w:W-2.8,h:0.6,fontFace:F,fontSize:26,bold:true,color:COR.azul,margin:0});if(sub)s.addText(sub,{x:0.5,y:0.9,w:W-2.8,h:0.4,fontFace:F,fontSize:13,color:COR.muted,margin:0})};
    const card=(s,x0,y0,w,h,v,l,cor)=>{s.addShape(p.ShapeType.roundRect,{x:x0,y:y0,w,h,fill:{color:COR.fundo},line:{color:COR.fundo},rectRadius:0.08});
      s.addShape(p.ShapeType.rect,{x:x0,y:y0+0.18,w:0.07,h:h-0.36,fill:{color:cor||COR.verde},line:{color:cor||COR.verde}});
      s.addText(String(v),{x:x0+0.25,y:y0+0.12,w:w-0.35,h:h*0.55,fontFace:F,fontSize:30,bold:true,color:cor||COR.verde,margin:0,valign:"bottom"});
      s.addText(l,{x:x0+0.25,y:y0+h*0.62,w:w-0.35,h:h*0.32,fontFace:F,fontSize:11,color:COR.muted,margin:0,valign:"top"})};
    const eixo={catAxisLabelFontFace:F,catAxisLabelFontSize:10,catAxisLabelColor:COR.muted,valAxisLabelFontFace:F,valAxisLabelFontSize:9,valAxisLabelColor:COR.muted,valGridLine:{color:"E6EBE9",size:0.75},catAxisLineShow:false,valAxisLineShow:false,
      showValue:true,dataLabelFontFace:F,dataLabelFontSize:10,dataLabelColor:COR.ink,showLegend:true,legendPos:"b",legendFontFace:F,legendFontSize:10,legendColor:COR.ink,titleFontFace:F};
    const pct=v=>v==null?"—":v+"%";
    /* capa */
    {const s=p.addSlide();
     s.background={color:"FFFFFF"};
     s.addShape(p.ShapeType.rect,{x:8.6,y:0,w:W-8.6,h:7.5,fill:{color:COR.verde},line:{color:COR.verde}});
     s.addShape(p.ShapeType.rect,{x:8.6,y:5.6,w:W-8.6,h:1.9,fill:{color:COR.azul},line:{color:COR.azul}});
     s.addImage({data:MARCA.cor,x:0.8,y:0.8,w:3.0,h:3.0/MARCA.proporcao});
     s.addText("Agrossilvipastoril",{x:0.8,y:0.8+3.0/MARCA.proporcao+0.08,w:4,h:0.4,fontFace:F,fontSize:16,bold:true,color:COR.verde,margin:0});
     s.addText("Indicadores do SPAT",{x:0.8,y:3.0,w:7.5,h:0.9,fontFace:F,fontSize:40,bold:true,color:COR.azul,margin:0});
     s.addText("Setor de Prospecção e Avaliação de Tecnologias",{x:0.8,y:3.9,w:7.5,h:0.45,fontFace:F,fontSize:18,color:COR.ink,margin:0});
     s.addText([{text:R.per.rotulo,options:{bold:true,color:COR.verde}},{text:`   ·   apresentação à chefia, ${R.geradoEm}`,options:{color:COR.muted}}],{x:0.8,y:4.6,w:7.6,h:0.4,fontFace:F,fontSize:14,margin:0});
     [[R.tot.con,"entregas concluídas"],[R.tot.rec,"demandas recebidas"],[pct(R.tot.prazo),"concluídas no prazo"]].forEach(([v,l],i)=>{
       s.addText(String(v),{x:9.1,y:0.9+i*1.5,w:3.8,h:0.85,fontFace:F,fontSize:48,bold:true,color:"FFFFFF",margin:0});
       s.addText(l,{x:9.1,y:1.7+i*1.5,w:3.8,h:0.35,fontFace:F,fontSize:14,color:"E4EFE9",margin:0})});
     s.addText(`${R.tot.and} em andamento hoje${R.tot.atr?` · ${R.tot.atr} atrasada(s)`:""}`,{x:9.1,y:6.15,w:3.9,h:0.6,fontFace:F,fontSize:16,bold:true,color:"FFFFFF",margin:0});
    }
    /* visão geral */
    {const s=p.addSlide({masterName:"SPAT"});titulo(s,"Visão geral do período",R.destaque);
     const k=[[R.tot.rec,`Demandas recebidas${R.tot.can?` · ${R.tot.can} cancelada(s)`:""}`,COR.azul],[R.tot.con,"Entregas concluídas",COR.verde],[pct(R.tot.prazo),"Concluídas no prazo",COR.verde],[R.tot.and,`Em andamento hoje · ${R.tot.atr} atrasada(s)`,R.tot.atr?COR.verm:COR.azul]];
     k.forEach(([v,l,c],i)=>card(s,0.5+i*3.1,1.5,2.9,1.25,v,l,c));
     s.addChart(p.ChartType.bar,[{name:"Recebidas",labels:R.dims.map(x=>x.d.curto),values:R.dims.map(x=>x.rec.length)},{name:"Concluídas",labels:R.dims.map(x=>x.d.curto),values:R.dims.map(x=>x.con.length)},{name:"Canceladas",labels:R.dims.map(x=>x.d.curto),values:R.dims.map(x=>x.can.length)}],
       {x:0.5,y:3.0,w:W-1,h:3.95,barDir:"col",barGrouping:"clustered",barGapWidthPct:60,chartColors:[COR.azul,COR.verde,COR.cinza],...eixo,showTitle:true,title:"Recebidas, concluídas e canceladas por dimensão",titleFontSize:13,titleColor:COR.azul});
    }
    /* evolução mensal */
    if(R.mensal.length>1){const s=p.addSlide({masterName:"SPAT"});titulo(s,"Evolução mensal","Demandas recebidas e entregas concluídas mês a mês");
     const labels=R.mensal.map(m=>m.rotulo);
     s.addChart(p.ChartType.bar,[{name:"Recebidas",labels,values:R.mensal.map(m=>m.rec)},{name:"Concluídas",labels,values:R.mensal.map(m=>m.con)}],{x:0.5,y:1.5,w:7.6,h:5.4,barDir:"col",barGapWidthPct:50,chartColors:[COR.azul,COR.verde],...eixo});
     let ac=0;const acum=R.mensal.map(m=>ac+=m.con);
     s.addChart(p.ChartType.line,[{name:"Concluídas acumuladas",labels,values:acum}],{x:8.3,y:1.5,w:4.55,h:5.4,chartColors:[COR.verde],lineSize:3,lineDataSymbol:"circle",lineDataSymbolSize:7,...eixo,showLegend:false,showTitle:true,title:"Acumulado no período",titleFontSize:12,titleColor:COR.azul});
    }
    /* uma por dimensão */
    R.dims.forEach(x=>{const s=p.addSlide({masterName:"SPAT"});
      titulo(s,x.d.nome,x.d.desc);
      const mets=[[x.rec.length,`Recebidas no período${x.can.length?` · ${x.can.length} cancelada(s)`:""}`],[x.con.length,"Entregas concluídas"],[pct(x.prazo),"Concluídas no prazo"],[x.tempo==null?"—":x.tempo+" d.u.","Tempo médio de atendimento"],[x.and.length,`Em andamento hoje${x.atr?` · ${x.atr} atrasada(s)`:""}`]];
      mets.forEach(([v,l],i)=>card(s,0.5,1.55+i*1.06,3.3,0.96,v,l,i===4&&x.atr?COR.verm:i===0?COR.azul:COR.verde));
      const ts=x.tipos;
      if(ts.some(t=>t.rec||t.con||t.and)) s.addChart(p.ChartType.bar,[{name:"Concluídas",labels:ts.map(t=>t.t.ind),values:ts.map(t=>t.con)},{name:"Em andamento",labels:ts.map(t=>t.t.ind),values:ts.map(t=>t.and)}],
        {x:4.1,y:1.5,w:W-4.6,h:x.meta?4.5:5.4,barDir:"bar",barGapWidthPct:ts.length<3?180:45,chartColors:[COR.verde,COR.azulClaro],catAxisOrientation:"maxMin",...eixo,valAxisHidden:true,valGridLine:{style:"none"},valAxisMajorUnit:1,catAxisLabelFontSize:11,showTitle:true,title:"Entregas por serviço",titleFontSize:12,titleColor:COR.azul});
      else s.addText("Sem movimentação nesta dimensão no período.",{x:4.1,y:3.2,w:W-4.6,h:0.6,fontFace:F,fontSize:16,color:COR.muted,align:"center"});
      if(x.meta){const fr=Math.min(1,x.conAno/x.meta);const y0=6.25,bx=4.1,bw=W-4.6;
        s.addText(`Meta anual de entregas: ${x.conAno} de ${x.meta} (${Math.round(x.conAno/x.meta*100)}%)`,{x:bx,y:y0-0.32,w:bw,h:0.3,fontFace:F,fontSize:12,bold:true,color:COR.ink,margin:0});
        s.addShape(p.ShapeType.roundRect,{x:bx,y:y0+0.05,w:bw,h:0.32,fill:{color:"E4EFE9"},line:{color:"E4EFE9"},rectRadius:0.16});
        if(fr>0)s.addShape(p.ShapeType.roundRect,{x:bx,y:y0+0.05,w:Math.max(0.32,bw*fr),h:0.32,fill:{color:COR.verde},line:{color:COR.verde},rectRadius:0.16});}
    });
    /* cronograma */
    {const G=R.gantt;const its=G.itens.filter(i=>!i.concluida).slice(0,14);const s=p.addSlide({masterName:"SPAT"});
     titulo(s,"Cronograma das ações",`Ações em andamento e planejadas · ${G.rotulo}`);
     const x0=4.6,x1=W-0.5,y0=1.75,rh=its.length?Math.min(0.36,4.35/its.length):0.36;const t0=+G.ini,t1=+G.fim;const X=d=>x0+(Math.min(Math.max(+d,t0),t1)-t0)/(t1-t0)*(x1-x0);
     G.meses.forEach(m=>{const xa=X(m.ini);s.addShape(p.ShapeType.line,{x:xa,y:y0-0.05,w:0,h:rh*Math.max(its.length,1)+0.1,line:{color:"E6EBE9",width:0.75}});s.addText(m.rotulo,{x:xa,y:y0-0.38,w:Math.max(0.4,X(m.fim)-xa),h:0.3,fontFace:F,fontSize:10,color:COR.muted,margin:0,align:"center"})});
     its.forEach((it,i)=>{const y=y0+i*rh;
       s.addText([{text:it.cod+"  ",options:{color:COR.muted,fontSize:8}},{text:it.titulo.length>44?it.titulo.slice(0,43)+"…":it.titulo,options:{color:COR.ink,fontSize:10}}],{x:0.5,y,w:x0-0.6,h:rh,fontFace:F,margin:0,valign:"middle"});
       const bh=rh*0.56,by=y+(rh-bh)/2;
       const xa=X(it.ini),xb=X(it.prev);
       if(xb>xa) s.addShape(p.ShapeType.rect,{x:xa,y:by,w:xb-xa,h:bh,fill:{color:it.planejada?"FFFFFF":"DCE4F6"},line:{color:COR.azulClaro,width:0.75,dashType:it.planejada?"dash":"solid"}});
       if(!it.planejada){const xf=X(it.feitoAte);if(xf>xa)s.addShape(p.ShapeType.rect,{x:xa,y:by,w:xf-xa,h:bh,fill:{color:COR.verde},line:{color:COR.verde,width:0.5}})}
       if(it.atrasoAte){const xr=X(it.atrasoAte);if(xr>xb)s.addShape(p.ShapeType.rect,{x:xb,y:by,w:xr-xb,h:bh,fill:{color:"E0675E"},line:{color:"E0675E",width:0.5}})}
     });
     if(G.hojeDentro){const xh=X(new Date());s.addShape(p.ShapeType.line,{x:xh,y:y0-0.05,w:0,h:rh*Math.max(its.length,1)+0.1,line:{color:COR.laranja,width:1.5,dashType:"dash"}});s.addText("hoje",{x:xh-0.3,y:y0+rh*Math.max(its.length,1)+0.05,w:0.6,h:0.25,fontFace:F,fontSize:9,bold:true,color:COR.laranja,align:"center",margin:0})}
     if(!its.length) s.addText("Nenhuma ação em andamento ou planejada no período.",{x:0.5,y:3.2,w:W-1,h:0.6,fontFace:F,fontSize:16,color:COR.muted,align:"center"});
     const ly=6.62;[["Executado",COR.verde,"solid"],["Planejado até a previsão","DCE4F6","solid"],["Ação planejada (não iniciada)","FFFFFF","dash"],["Atraso","E0675E","solid"]].forEach(([l,c,dt],i)=>{const lx=0.5+i*3.1;s.addShape(p.ShapeType.rect,{x:lx,y:ly+0.06,w:0.35,h:0.2,fill:{color:c},line:{color:c==="FFFFFF"||c==="DCE4F6"?COR.azulClaro:c,dashType:dt}});s.addText(l,{x:lx+0.45,y:ly,w:2.6,h:0.32,fontFace:F,fontSize:10,color:COR.muted,margin:0})});
     if(G.itens.filter(i=>!i.concluida).length>14) s.addText(`Mostrando 14 de ${G.itens.filter(i=>!i.concluida).length} ações; a lista completa está no Excel.`,{x:0.5,y:6.3,w:8,h:0.25,fontFace:F,fontSize:9,italic:true,color:COR.muted,margin:0});
    }
    /* impactos */
    if(R.ativos.length){const s=p.addSlide({masterName:"SPAT"});const av=R.ativos.filter(a=>a.modo==="Avaliação").length;
     titulo(s,"Carteira de impactos",`${R.ativos.length} ativo(s): ${av} em avaliação e ${R.ativos.length-av} em monitoramento`);
     const head=["Ativo","Modo","Ciclo ou estudo","Etapa atual","Previsão"].map(t=>({text:t,options:{bold:true,color:"FFFFFF",fill:{color:COR.verde}}}));
     const body=R.ativos.slice(0,11).map(a=>[a.nome,{text:a.modo,options:{color:a.modo==="Avaliação"?COR.verde:COR.azul,bold:true}},a.ciclo,a.etapa,a.prazoTxt]);
     s.addTable([head,...body],{x:0.5,y:1.5,w:W-1,colW:[3.6,1.5,3.6,2.4,1.233],fontFace:F,fontSize:11,color:COR.ink,border:{type:"solid",color:COR.linha,pt:0.75},rowH:0.42,valign:"middle",autoPage:false});
    }
    /* pontos de atenção */
    {const s=p.addSlide({masterName:"SPAT"});titulo(s,"Pontos de atenção",`${R.atrasadas.length} demanda(s) atrasada(s) e ${R.chefia.length} aguardando aprovação da chefia`);
     const head=["Código","Demanda","Serviço","Responsável","Situação"].map(t=>({text:t,options:{bold:true,color:"FFFFFF",fill:{color:COR.azul}}}));
     const linhas=[...R.atrasadas.map(d=>[d.cod,d.titulo,d.servico,d.responsavel,{text:d.situacao,options:{color:COR.verm,bold:true}}]),...R.chefia.map(d=>[d.cod,d.titulo,d.servico,d.responsavel,{text:"Aguardando chefia",options:{color:COR.laranja,bold:true}}])].slice(0,11);
     if(linhas.length) s.addTable([head,...linhas],{x:0.5,y:1.5,w:W-1,colW:[1.7,4.1,2.8,1.9,1.833],fontFace:F,fontSize:11,color:COR.ink,border:{type:"solid",color:COR.linha,pt:0.75},rowH:0.42,valign:"middle",autoPage:false});
     else s.addText("Nenhuma demanda atrasada ou parada em aprovação.",{x:0.5,y:3.2,w:W-1,h:0.6,fontFace:F,fontSize:18,color:COR.verde,bold:true,align:"center"});
    }
    const out=await p.write({outputType:"uint8array"}); return out;
  }
  return {xlsx,pptx};
})();
