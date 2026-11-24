const API_PEDIDO='http://localhost:3001/pedido';
const carrinho=ler('carrinhoParigot',[]);
const preferencias=ler('preferenciasPedidoParigot',null);
const pagamento=lerSessao('pagamentoParigot',null);
const el=id=>document.getElementById(id);
const botao=el('confirmarPedido');
const mensagem=el('mensagem');
let pedidoCriado=null;

function ler(chave,padrao){try{return JSON.parse(localStorage.getItem(chave)||'null')??padrao}catch{return padrao}}
function lerSessao(chave,padrao){try{return JSON.parse(sessionStorage.getItem(chave)||'null')??padrao}catch{return padrao}}
function moeda(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function seguro(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function nomeMetodo(m){return ({pix:'PIX',credito:'Cartão de crédito',debito:'Cartão de débito',dinheiro:'Dinheiro'})[m]||m}

function inicializar(){
 if(!sessionStorage.getItem('token')){sessionStorage.setItem('redirecionarAposLogin','../revisaoPedido/revisaoPedido.html');location.href='../login/login.html';return}
 if(!carrinho.length||!preferencias||!pagamento){mensagem.textContent='Não encontramos todas as informações da compra. Volte ao carrinho e refaça as etapas.';botao.disabled=true;return}
 const embrulhos=preferencias.embrulhos||{};
 el('listaProdutos').innerHTML=carrinho.map(i=>{const id=Number(i.id_produto??i.id??i.produto_id_produto);return `<div class="produto"><span><strong>${seguro(i.nome||i.nome_produto)}</strong><small>Quantidade: ${Number(i.quantidade)} · ${embrulhos[String(id)]?'Com embrulho para presente · R$ 1,50/un.':'Sem embrulho'}</small></span><strong>${moeda(Number(i.preco)*Number(i.quantidade))}</strong></div>`}).join('');
 el('dadosRecebimento').innerHTML=preferencias.recebimento==='entrega'?`<p>Entrega no endereço:</p><strong>${seguro(preferencias.enderecoEntrega)}</strong>`:'<strong>Retirada na loja</strong>';
 el('dadosPagamento').innerHTML=(pagamento.pagamentos||[]).map(p=>`<div class="pagamento"><span>${seguro(nomeMetodo(p.metodo))}${p.parcelas?` · ${p.parcelas}x`:''}<small class="muted">Principal ${moeda(p.valor_principal??p.valor)} · Juros ${moeda(p.valor_juros)}</small></span><strong>${moeda(p.valor_total)}</strong></div>`).join('');
 el('subtotal').textContent=moeda(pagamento.subtotalProdutos);el('taxaEntrega').textContent=moeda(pagamento.taxaEntrega);el('taxaEmbrulho').textContent=moeda(pagamento.taxaEmbrulho);el('juros').textContent=moeda(pagamento.jurosCredito);el('total').textContent=moeda(pagamento.totalComJuros);
}
function payloadPixDoPedido(p){
 // O valor do PIX vem do servidor (já validado); o identificador é o número do pedido.
 const valor=Number(p.valor_total??p.valor??0);
 return PixParigot.gerarPayloadPix({valor,txid:`PEDIDO${pedidoCriado.id_pedido}`});
}
function mostrarPix(p){
 const valor=Number(p.valor_total??p.valor??0);
 let codigo='',erroPix='';
 try{codigo=payloadPixDoPedido(p)}catch(e){erroPix=e.message}
 if(erroPix)return `<section class="bloco-pagamento"><h2>Pagamento por PIX</h2><p>Pedido <strong>#${pedidoCriado.id_pedido}</strong> registrado, mas não foi possível gerar o PIX: ${seguro(erroPix)} Entre em contato com a loja.</p></section>`;
 return `<section class="bloco-pagamento"><h2>Pagamento por PIX</h2><p>Pedido <strong>#${pedidoCriado.id_pedido}</strong> · Valor: <strong>${moeda(valor)}</strong></p><p>Abra o app do seu banco e leia o QR Code, ou use o PIX Copia e Cola abaixo. Favorecido: <strong>${seguro(PixParigot.CONFIG_PIX.nomeRecebedor)}</strong>.</p><div id="qrcodePosPedido" class="qrcode-pos-pedido"></div><label for="codigoPixPosPedido">PIX Copia e Cola</label><textarea id="codigoPixPosPedido" readonly rows="4">${seguro(codigo)}</textarea><button type="button" class="botao-secundario" id="copiarCodigoPix">Copiar código PIX</button><p class="aviso-cartao">Confira o valor e o nome do favorecido antes de pagar. O site não recebe aviso de pagamento: a loja confirma o recebimento no banco.</p></section>`;
}
function mostrarCartao(p,indice){
 const valor=Number(p.valor_total??p.valor??0);
 const titulo=p.metodo==='credito'?'Cartão de crédito':'Cartão de débito';
 return `<section class="bloco-pagamento"><h2>${titulo}</h2><p>Valor da simulação: <strong>${moeda(valor)}</strong>${p.parcelas?` · ${p.parcelas} parcela(s)`:''}</p>
 <form class="form-cartao" data-metodo="${seguro(p.metodo)}" novalidate>
 <label for="nomeCartao${indice}">Nome impresso no cartão</label><input id="nomeCartao${indice}" name="nome" autocomplete="cc-name" required maxlength="70" placeholder="Como aparece no cartão">
 <label for="numeroCartao${indice}">Número do cartão (simulação)</label><input id="numeroCartao${indice}" name="numero" inputmode="numeric" autocomplete="off" required minlength="13" maxlength="19" placeholder="0000 0000 0000 0000">
 <div class="campos-cartao"><div><label for="validadeCartao${indice}">Validade</label><input id="validadeCartao${indice}" name="validade" required maxlength="5" placeholder="MM/AA" inputmode="numeric"></div><div><label for="cvvCartao${indice}">CVV</label><input id="cvvCartao${indice}" name="cvv" required minlength="3" maxlength="4" inputmode="numeric" autocomplete="off" placeholder="•••"></div></div>
 <p class="aviso-cartao">Use dados fictícios. Os campos são usados apenas para validar a demonstração e não são enviados ao servidor nem armazenados.</p>
 <button class="botao-continuar" type="submit">Simular pagamento</button></form></section>`;
}
function finalizarEtapas(){
 const area=el('etapaPagamento');
 area.innerHTML=`<section class="bloco-pagamento sucesso-pagamento"><h2>Etapas concluídas!</h2><p>Pedido <strong>#${pedidoCriado.id_pedido}</strong> registrado. A loja confirmará o pagamento e os detalhes do seu pedido.</p><a class="botao-continuar link-loja" href="../dashboard/dashboard.html">Voltar à loja</a></section>`;
 botao.hidden=true;
}
function adicionarBotaoConcluir(){
 const area=el('etapaPagamento');
 if(el('concluirEtapas'))return;
 const b=document.createElement('button');
 b.type='button';b.id='concluirEtapas';b.className='botao-continuar';b.textContent='Concluir pedido';
 b.addEventListener('click',finalizarEtapas);
 area.appendChild(b);
}
function renderizarEtapas(){
 const area=el('etapaPagamento');
 const pagamentos=pagamento.pagamentos||[];
 const pagPix=pagamentos.find(p=>p.metodo==='pix');
 const cartoes=pagamentos.filter(p=>['credito','debito'].includes(p.metodo));
 const outros=pagamentos.filter(p=>p.metodo==='dinheiro');
 let html='';
 if(pagPix) html+=mostrarPix(pagPix);
 cartoes.forEach((p,i)=>html+=mostrarCartao(p,i));
 if(outros.length){
   html+=`<section class="bloco-pagamento"><h2>Pagamento em dinheiro</h2><p>${outros.map(p=>`${moeda(p.valor_total??p.valor)}${p.precisaTroco&&p.valor_troco?` (troco para ${moeda(p.valor_troco)})`:''}`).join(' · ')} — será acertado com a loja no recebimento.</p></section>`;
 }
 area.innerHTML=html;
 area.hidden=false;

 if(pagPix){
   const q=el('qrcodePosPedido');
   const botaoCopiar=el('copiarCodigoPix');
   if(q){
     try{PixParigot.desenharQrCode(q,payloadPixDoPedido(pagPix),220)}catch(e){q.textContent='Não foi possível gerar o QR Code. Use o código Copia e Cola.'}
   }
   if(botaoCopiar)botaoCopiar.addEventListener('click',async()=>{
     const campo=el('codigoPixPosPedido');
     try{await navigator.clipboard.writeText(campo.value)}catch{campo.select();document.execCommand('copy')}
     botaoCopiar.textContent='Código copiado!';
   });
 }

 const forms=[...area.querySelectorAll('form.form-cartao')];
 let pendentes=forms.length;
 forms.forEach(form=>{
   const numero=form.elements.numero, validade=form.elements.validade, cvv=form.elements.cvv;
   numero.addEventListener('input',()=>{numero.value=numero.value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim()});
   validade.addEventListener('input',()=>{let v=validade.value.replace(/\D/g,'').slice(0,4);if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);validade.value=v});
   cvv.addEventListener('input',()=>{cvv.value=cvv.value.replace(/\D/g,'').slice(0,4)});
   form.addEventListener('submit',e=>{
     e.preventDefault();
     const n=numero.value.replace(/\D/g,'');
     const [mes,ano]=(validade.value||'').split('/').map(Number);
     if(!form.elements.nome.value.trim()||n.length<13||n.length>16||!mes||mes>12||!ano||cvv.value.length<3){mensagem.textContent='Confira os dados fictícios do cartão.';return}
     mensagem.textContent='';
     // Os dados do cartão não são enviados nem armazenados.
     form.innerHTML='<p class="sucesso-pagamento"><strong>Simulação aprovada!</strong><br>Os dados do cartão foram descartados e não foram armazenados.</p>';
     pendentes-=1;
     if(pendentes===0)adicionarBotaoConcluir();
   });
 });
 if(pendentes===0)adicionarBotaoConcluir();
}
botao.addEventListener('click',async()=>{
 if(botao.disabled||pedidoCriado)return;
 const token=sessionStorage.getItem('token');
 if(!token){sessionStorage.setItem('redirecionarAposLogin','../revisaoPedido/revisaoPedido.html');location.href='../login/login.html';return}
 botao.disabled=true;botao.textContent='Registrando pedido...';mensagem.textContent='';
 try{
  const resposta=await fetch(API_PEDIDO,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({itens:carrinho.map(i=>({id_produto:Number(i.id_produto??i.id??i.produto_id_produto),quantidade:Number(i.quantidade)})),preferenciasPedido:preferencias,pagamentos:pagamento.pagamentos.map(p=>({metodo:p.metodo,valor:Number(p.valor_principal??p.valor),parcelas:p.parcelas,precisaTroco:p.precisaTroco,valorTroco:p.valor_troco??p.valorTroco}))})});
  const dados=await resposta.json();if(!resposta.ok)throw new Error(dados.mensagem||'Não foi possível registrar o pedido.');
  pedidoCriado=dados.pedido;
  localStorage.removeItem('carrinhoParigot');localStorage.removeItem('preferenciasPedidoParigot');sessionStorage.removeItem('pagamentoParigot');
  el('listaProdutos').innerHTML='';el('dadosRecebimento').innerHTML='';el('dadosPagamento').innerHTML='';
  mensagem.classList.add('sucesso');mensagem.textContent=`Pedido #${pedidoCriado.id_pedido} registrado! Prossiga com o pagamento abaixo.`;
  botao.hidden=true;renderizarEtapas();
 }catch(erro){mensagem.textContent=erro.message||'Erro ao registrar pedido. Seu carrinho foi preservado.';botao.disabled=false;botao.textContent='Tentar novamente';}
});
inicializar();
