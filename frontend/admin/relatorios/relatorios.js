const API_RELATORIOS = 'http://localhost:3001';
const mensagemRelatorios = document.getElementById('mensagem');
const formatarDataHora = valor => valor ? new Date(valor).toLocaleString('pt-BR') : '-';
const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function requisitar(caminho) {
    const resposta = await fetch(`${API_RELATORIOS}${caminho}`);
    const dados = await resposta.json();
    if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || 'Não foi possível carregar os dados.');
    return dados;
}
async function carregarHistorico() {
    const corpo = document.getElementById('listaHistorico');
    corpo.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    const dados = await requisitar('/relatorios/historico?limite=300');
    corpo.innerHTML = dados.movimentacoes.length ? dados.movimentacoes.map(item => `<tr><td>${escapar(formatarDataHora(item.data_hora))}</td><td>${escapar(item.descricao)}</td><td>${escapar(item.nome_pessoa)}</td><td>${escapar(item.cpf_pessoa)}</td></tr>`).join('') : '<tr><td colspan="4" class="vazio">Nenhuma movimentação registrada ainda.</td></tr>';
}
async function carregarRanking() {
    const corpo = document.getElementById('listaRanking');
    corpo.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    const dados = await requisitar('/relatorios/ranking-produtos');
    corpo.innerHTML = dados.ranking.length ? dados.ranking.map((item, i) => `<tr><td>${i + 1}º</td><td>${escapar(item.nome_produto)}</td><td>${Number(item.quantidade_vendida)}</td><td>${Number(item.quantidade_pedidos)}</td><td>${moeda(item.total_vendido)}</td></tr>`).join('') : '<tr><td colspan="5" class="vazio">Nenhum produto cadastrado.</td></tr>';
}
async function carregarComentarios() {
    const corpo = document.getElementById('listaComentarios');
    corpo.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    const dados = await requisitar('/comentario/admin');
    corpo.innerHTML = dados.comentarios.length ? dados.comentarios.map(item => `<tr><td>${escapar(formatarDataHora(item.data_comentario))}</td><td>${escapar(item.nome_produto)}</td><td>${escapar(item.nome_pessoa)}</td><td>${escapar(item.cpf_comentador)}</td><td><span class="estrelas">${'★'.repeat(Number(item.avaliacao))}${'☆'.repeat(5 - Number(item.avaliacao))}</span></td><td>${escapar(item.texto_comentario)}</td></tr>`).join('') : '<tr><td colspan="6" class="vazio">Nenhum comentário recebido.</td></tr>';
}
const carregadores = { historico: carregarHistorico, ranking: carregarRanking, comentarios: carregarComentarios };
async function atualizar(secao) { mensagemRelatorios.textContent = ''; try { await carregadores[secao](); } catch (erro) { mensagemRelatorios.textContent = erro.message; } }
document.querySelectorAll('.aba').forEach(botao => botao.addEventListener('click', () => {
    document.querySelectorAll('.aba').forEach(aba => aba.classList.toggle('ativa', aba === botao));
    document.querySelectorAll('.painel').forEach(painel => painel.hidden = painel.id !== `painel-${botao.dataset.alvo}`);
    atualizar(botao.dataset.alvo);
}));
document.querySelectorAll('[data-atualizar]').forEach(botao => botao.addEventListener('click', () => atualizar(botao.dataset.atualizar)));
atualizar('historico');
