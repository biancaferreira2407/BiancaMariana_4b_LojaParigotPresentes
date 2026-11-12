const API = 'http://localhost:3001';
let devolucoes = [], pedidosDisponiveis = []
let pedidoSelecionado = null, itensPedido = []
let editando = null;
const $ = (id) => document.getElementById(id);
const form = $('formDevolucao')
const selectPedido = $('pedido')
const produtosPedido = $('produtosPedido');

window.addEventListener('DOMContentLoaded', async () => { 
    $('data_devolucao').value = new Date().toISOString().slice(0, 10); 
    await Promise.all([carregarPedidos(), carregarDevolucoes()]); 
});


selectPedido.addEventListener('change', carregarProdutosPedido);
form.addEventListener('submit', salvarDevolucao);

$('btnLimparBusca').addEventListener('click', () => { 
    $('buscar').value = ''; 
    renderizarDevolucoes(devolucoes); 
});


$('buscar').addEventListener('input', filtrarDevolucoes);
$('btnCancelarEdicao').addEventListener('click', cancelarEdicao);
$('btnLimpar').addEventListener('click', () => setTimeout(limparSelecao, 0));
$('fecharModal').addEventListener('click', fecharModal);


$('modalDetalhes').addEventListener('click', e => { 
    if (e.target === $('modalDetalhes')) fecharModal(); 
});


document.addEventListener('keydown', e => { 
    if (e.key === 'Escape') fecharModal(); 
});


async function requisicao(url, opcoes = {}) { 
    const r = await fetch(`${API}${url}`, { ...opcoes, headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) } }); 
    const d = await r.json(); 
    
    if (!r.ok || d.sucesso === false) 
        throw new Error(d.mensagem || 'Erro na operação.'); 
    return d; 
}


async function carregarPedidos() { 
    try { 
        const d = await requisicao('/devolucao/pedidos-disponiveis'); 
        pedidosDisponiveis = d.pedidos || []; 
        selectPedido.innerHTML = '<option value="">Selecione um pedido</option>' + 
                                 pedidosDisponiveis.map(p => 
                                    `<option value="${p.id_pedido}">Pedido #${p.id_pedido} — ${esc(p.nome_cliente || 'Sem cliente')} 
                                    (${data(p.data_pedido)})</option>`).join(''); 
    } catch (e) { 
        mensagem(e.message); 
    } 
}


async function carregarProdutosPedido() {
    const id = selectPedido.value; pedidoSelecionado = null; itensPedido = []; 
    produtosPedido.innerHTML = '';
    if (!id) { 
        $('infoPedido').textContent = 'Selecione um pedido para visualizar os produtos.'; 
        return; 
    }

    try {
        const d = await requisicao(`/pedido/${id}`); 
        pedidoSelecionado = d.pedido; 
        itensPedido = d.pedido.produtos || [];

        $('infoPedido').textContent = `Pedido #${id} | Cliente: ${d.pedido.nome_cliente || 'Sem cliente'} | Data da compra: ${data(d.pedido.data_pedido)}`;
        produtosPedido.innerHTML = `<table><thead><tr><th>Devolver</th>
                               <th>Produto</th>
                               <th>Comprada</th>
                               <th>Quantidade a devolver</th>
                               <th>Preço unitário</th></tr></thead>
                            <tbody>${itensPedido.map((p, i) => `<tr>
                                  <td><input type="checkbox" class="selecionar-produto" data-i="${i}"></td>
                                  <td>${esc(p.nome_produto)}</td><td>${p.quantidade}</td>
                                  <td><input type="number" class="qtd-devolver" data-i="${i}" min="1" max="${p.quantidade}" value="${p.quantidade}" disabled style="width:85px"></td>
                                  <td>${moeda(p.preco_unitario)}</td></tr>`).join('')}</tbody></table>`;

        produtosPedido.querySelectorAll('.selecionar-produto').forEach(c => c.addEventListener('change', () => { 
                                                        produtosPedido.querySelector(`.qtd-devolver[data-i="${c.dataset.i}"]`).disabled = !c.checked; }));
    } catch (e) { 
        mensagem(e.message); 
    }
}


async function salvarDevolucao(e) {
    e.preventDefault(); 
    if (editando) { 
        await atualizarDevolucao(); 
        return; 
    }
    const produtos = [...produtosPedido.querySelectorAll('.selecionar-produto:checked')].map(c => { const i = 
        Number(c.dataset.i); 
        return { produto_id_produto: itensPedido[i].id_produto || itensPedido[i].produto_id_produto, quantidade: Number(produtosPedido.querySelector(`.qtd-devolver[data-i="${i}"]`).value) }; 
    });

    if (!produtos.length) { 
        mensagem('Selecione pelo menos um produto.'); 
        return; 
    }
    try { 
        const d = await requisicao('/devolucao', { 
            method: 'POST', 
            body: JSON.stringify({ pedido_id_pedido: Number(selectPedido.value), 
                data_devolucao: $('data_devolucao').value, 
                motivo_devolucao: $('motivo').value, produtos }) 
            });
            
        mensagem(d.mensagem); 
        form.reset(); 
        
        limparSelecao(); 
        
        $('data_devolucao').value = new Date().toISOString().slice(0, 10); 
        await Promise.all([carregarPedidos(), carregarDevolucoes()]); 
    }
    catch (err) { 
        mensagem(err.message); 
    }
}


async function carregarDevolucoes() { 
    try { 
        const d = await requisicao('/devolucao'); 
        devolucoes = d.devolucoes || []; 
        renderizarDevolucoes(devolucoes); 
    } catch (e) { 
        $('tabelaDevolucoes').innerHTML = `<tr><td colspan="7" class="mensagem-vazia">${esc(e.message)}</td></tr>`; 
    } 
}


function renderizarDevolucoes(lista) { 
    const tbody = $('tabelaDevolucoes'); 
    
    if (!lista.length) { 
        tbody.innerHTML = '<tr><td colspan="7" class="mensagem-vazia">Nenhuma devolução cadastrada.</td></tr>'; 
        return; 
    } 
    
    tbody.innerHTML = lista.map(d => `<tr><td>${d.id_devolucao}</td>
        <td>#${d.pedido_id_pedido}</td><td>${data(d.data_devolucao)}</td>
        <td>${esc(d.nome_cliente || 'Sem cliente')}</td><td>${esc(d.motivo_devolucao)}</td>
        <td>${moeda(d.valor_total)}</td>
        <td><button class="btn-acao" onclick="visualizar(${d.id_devolucao})">Visualizar</button> 
        <button class="btn-acao" onclick="editar(${d.id_devolucao})">Editar</button> 
        <button class="btn-acao btn-excluir" onclick="excluir(${d.id_devolucao})">Excluir</button>
        </td></tr>`
    ).join(''); 
    
}


function filtrarDevolucoes() { 
    const t = norm($('buscar').value); 

    renderizarDevolucoes(devolucoes.filter(d => 
        norm([d.id_devolucao, d.pedido_id_pedido, d.data_devolucao, d.nome_cliente, d.motivo_devolucao].join(' ')).includes(t))
    ); 
}


async function visualizar(id) { 
    try { 
        const d = (await requisicao(`/devolucao/${id}`)).devolucao; 
        $('tituloDetalhes').textContent = `Devolução #${d.id_devolucao}`; 
        $('detalhes').innerHTML = `<div class="dados"><div><b>Pedido:</b> #${d.pedido_id_pedido}</div>
                       <div><b>Data:</b> ${data(d.data_devolucao)}</div>
                       <div><b>Cliente:</b> ${esc(d.nome_cliente || 'Sem cliente')}</div>
                       <div><b>Funcionário:</b> ${esc(d.nome_funcionario || 'Não informado')}</div>
                       <div><b>Motivo:</b> ${esc(d.motivo_devolucao)}</div></div>
                       <h3>Produtos devolvidos</h3>
                       <div class="table-container">
                        <table><thead><tr><th>Produto</th>
                         <th>Quantidade</th>
                         <th>Preço unitário</th>
                         <th>Subtotal</th></tr></thead>
                       <tbody>${d.produtos.map(p => `<tr><td>${esc(p.nome_produto)}</td>
                             <td>${p.quantidade}</td>
                             <td>${moeda(p.preco_unitario)}</td>
                             <td>${moeda(Number(p.quantidade) * Number(p.preco_unitario))}</td></tr>`).join('')}</tbody></table></div>`; 
        
        $('modalDetalhes').classList.add('aberto'); 
        $('modalDetalhes').setAttribute('aria-hidden', 'false'); 
    
    } catch (e) { 
        mensagem(e.message); 
    } 
}


async function editar(id) { 
    try { 
        const d = (await requisicao(`/devolucao/${id}`)).devolucao; 
        
        editando = id; $('tituloFormulario').textContent = `Editar devolução #${id}`; 
        
        $('btnSalvar').textContent = 'Salvar alterações'; 
        $('btnCancelarEdicao').classList.remove('oculto'); 
        
        selectPedido.disabled = true; selectPedido.innerHTML = `<option value="${d.pedido_id_pedido}">Pedido #${d.pedido_id_pedido}</option>`; 
        
        $('data_devolucao').value = String(d.data_devolucao).slice(0, 10); 
        $('motivo').value = d.motivo_devolucao; 
        
        produtosPedido.innerHTML = '<p>Os produtos de uma devolução registrada não podem ser alterados.</p>'; 
        
        $('infoPedido').textContent = `Cliente: ${d.nome_cliente || 'Sem cliente'}`; 
        
        form.scrollIntoView({ behavior: 'smooth' }); } catch (e) { mensagem(e.message); 

    } 
}


async function atualizarDevolucao() { 
    try { 
        const d = await requisicao(`/devolucao/${editando}`, { 
            method: 'PUT', 
            body: JSON.stringify({ data_devolucao: $('data_devolucao').value, 
            motivo_devolucao: $('motivo').value }) 
        }); 
        
        mensagem(d.mensagem); 
        cancelarEdicao(); 
        await carregarDevolucoes(); 
    } catch (e) { 
        mensagem(e.message); 
    } 
}


async function excluir(id) { 
    if (!confirm(`Deseja realmente excluir a devolução #${id}? O estoque será ajustado.`)) 
        return; 
    try { 
        const d = await requisicao(`/devolucao/${id}`, { 
            method: 'DELETE' 
        }); 
        
        mensagem(d.mensagem); 
        await Promise.all([carregarDevolucoes(), carregarPedidos()]); 
    } catch (e) { 
        mensagem(e.message); 
    } 
}


function cancelarEdicao() { 
    editando = null; 
    form.reset(); 
    selectPedido.disabled = false; 
    
    $('tituloFormulario').textContent = 'Registrar devolução'; 
    $('btnSalvar').textContent = 'Registrar devolução'; 
    $('btnCancelarEdicao').classList.add('oculto'); 
    
    limparSelecao(); 
    
    $('data_devolucao').value = new Date().toISOString().slice(0, 10); 
}

function limparSelecao() { 
    pedidoSelecionado = null; 
    itensPedido = []; 
    selectPedido.value = ''; 
    produtosPedido.innerHTML = ''; 
    $('infoPedido').textContent = 'Selecione um pedido para visualizar os produtos.'; 
}


function fecharModal() { 
    $('modalDetalhes').classList.remove('aberto'); 
    $('modalDetalhes').setAttribute('aria-hidden', 'true'); 
}

function mensagem(txt) { 
    const el = $('mensagem'); 
    el.textContent = txt; el.classList.add('visivel'); 
    setTimeout(() => el.classList.remove('visivel'), 3500); 
}

function moeda(v) { 
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); 
} 

function data(v) { 
    if (!v) 
        return '-'; 
    
    const p = String(v).slice(0, 10).split('-'); 
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v; 
} 

function norm(v) { 
    return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); 
} 

function esc(v) { 
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); 
}

window.visualizar = visualizar; 
window.editar = editar; 
window.excluir = excluir;
