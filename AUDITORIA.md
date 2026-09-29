# Auditoria e refatoração — SimpleChurch

Revisão de 29/09/2026. Escopo: arquivos versionados da landing, endpoints, validação, integração com Supabase, scripts de build, publicação, dependências, documentação e experiência visual. Não inclui o código do SaaS citado em `.Docs/`, que não está neste repositório, nem uma auditoria da infraestrutura externa.

## Achados e correções

| Prioridade | Achado                                                                                                | Correção                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Alta       | Dois handlers com regras divergentes e servidor minificado manualmente                                | Handler compartilhado, separação entre transporte, domínio e inicialização; arquivos formatados  |
| Alta       | CORS removia permissões de leitura, mas não bloqueava necessariamente a gravação de origens recusadas | Rejeição explícita de origens não permitidas antes da persistência                               |
| Alta       | Confiança incondicional em proxy e extração manual de IP                                              | Proxy Express configurável, sem confiança por padrão; adaptador específico para a plataforma     |
| Alta       | Falha na atualização do status do webhook podia transformar um cadastro salvo em resposta de erro     | Persistência isolada da notificação; erro secundário não provoca falso insucesso                 |
| Média      | Auditoria online identificou alertas moderados em Express/body-parser/qs                              | Express 4.22.3 e dependências transitivas corrigidas; lockfile atualizado                        |
| Média      | Payload aceitava faixas arbitrárias, timestamps livres e chaves de tracking ilimitadas                | Enumeração de faixas, validação de telefone/data, lista de tracking e horário gerado no servidor |
| Média      | Consentimento validado mas não persistido como evidência                                              | Consentimento, versão e horário registrados no JSON existente                                    |
| Média      | Map de limitação crescia sem limpeza                                                                  | Expiração e teto de 10 mil entradas; limite uniforme nos dois ambientes                          |
| Média      | Políticas de segurança locais e Vercel divergentes                                                    | Mesmos cabeçalhos, proteção de framing/objetos e verificação automática no build                 |
| Média      | Tags opcionais carregavam imediatamente e podiam duplicar provedores com GTM                          | Escolha de privacidade, carregamento condicionado, preferência persistida e prioridade ao GTM    |
| Média      | `aria-invalid` era booleano HTML vazio, sem o valor ARIA correto                                      | Valores explícitos, validação de espaços, foco no primeiro erro e contraste corrigido            |
| Média      | Máscara rejeitava telefone colado com +55 e prazo podia terminar perto do webhook                     | Normalização do prefixo, validação alinhada e prazos distintos por operação                      |
| Baixa      | Documentação descrevia fallback inexistente; faltavam testes, sitemap e robots                        | Documentação atualizada, testes de backend/navegador e validação do build                        |

O destino legado do webhook foi preservado para instalações sem variável explícita. `N8N_WEBHOOK_URL` permite substituí-lo; valor vazio desativa a notificação. Essa compatibilidade evita interromper o fluxo comercial existente durante a atualização.

## Redesign e comunicação

- Sistema visual com verde profundo, fundos claros, acentos suaves, tipografia Manrope/DM Sans e títulos editoriais em serifada.
- Nova composição de abertura, demonstração ilustrativa do produto, grade de módulos, diagrama de congregações e apresentação do App do membro.
- Benefícios organizados por rotina, explicação da demonstração em três etapas, FAQ com objeções comuns e formulário em duas colunas no desktop.
- Chamadas de ação consistentes, contato alternativo e redução de incerteza com os próximos passos. Nenhuma promessa de resultado, número de clientes ou depoimento foi inventado.
- Dados dos mockups identificados como exemplos. Funcionalidades editoriais apoiadas na documentação do produto e conteúdo anterior.
- Layout responsivo, foco visível, navegação por teclado, Escape no menu, preferência por movimento reduzido e mensagens acessíveis.
- Páginas de confirmação, privacidade e termos integradas à identidade visual.

## Otimização para agendamento de demonstração

- O hero passou a identificar o produto e seus módulos na primeira leitura, com promessa centrada em organização e tempo para cuidar. O CTA principal foi padronizado como “Agendar demonstração” e o secundário conduz à prova do produto.
- A navegação e as chamadas dos módulos agora formam um percurso único: entender a proposta, ver o produto, avaliar os benefícios, resolver objeções e chegar ao formulário.
- Foram removidos números fictícios do painel ilustrativo. A página não apresenta volume de clientes, vendas, resultados, depoimentos ou métricas sem evidência.
- A prova de produto ganhou duas capturas reais das telas públicas de acesso administrativo e do membro. Elas estão identificadas como telas reais, enquanto as composições internas continuam claramente descritas como prévias ilustrativas com dados fictícios.
- Como as áreas internas exigem autenticação e não havia capturas autorizadas no repositório ou na documentação disponível, nenhum conteúdo interno foi fabricado como prova real. Os fluxos autenticados são apresentados ao vivo durante a demonstração.
- A seção de processo, o FAQ e o encerramento explicitam que a conversa é guiada, adaptada à rotina da igreja e sem compromisso de contratação. O formulário informa o tempo estimado, o próximo passo por WhatsApp e a finalidade do uso dos dados.
- A identidade existente foi preservada: paleta, tipografia, linguagem gráfica, componentes, ritmos e comportamento responsivo continuam os mesmos.

## Refinamento final

- O espaçamento vertical padrão entre seções foi reduzido de forma discreta em desktop, tablet e celular, mantendo a composição e a hierarquia existentes.
- Textos funcionais pequenos receberam ajustes de tamanho em prova de produto, módulos, jornada, FAQ, formulário, preferências de privacidade e rodapé. Elementos internos das ilustrações permaneceram compactos para preservar a proporção dos mockups.
- A objeção sobre facilidade de adoção pela equipe foi adicionada ao FAQ sem prometer treinamento, prazo de implantação ou suporte não documentado.
- A busca por capturas internas cobriu o repositório, a documentação local e as imagens relacionadas disponíveis. Não foi encontrada uma captura atual e autorizada do ambiente autenticado do SimpleChurch com dados fictícios; o navegador compartilhado também não tinha sessão aberta. As telas públicas de login foram mantidas provisoriamente para não apresentar protótipos antigos ou interfaces de terceiros como se fossem o produto atual.

## Verificação executada

- Testes de backend: contratos HTTP, origens, validação, consentimento, datas, limite, honeypot, falhas de persistência/notificação, sigilo de arquivos e política de segurança.
- Navegador Chrome: larguras 320, 375, 430, 768, 1024 e 1440; ausência de overflow horizontal e de âncoras quebradas.
- Jornada de conversão: CTA do hero conduz ao formulário; telas reais carregam em todas as larguras testadas; formulário com API simulada cobre dados inválidos, foco no erro, telefone +55, falha preservando campos, nova tentativa e redirecionamento de sucesso. Nenhum lead de teste foi enviado à operação comercial.
- Analytics: nenhum carregamento antes da aceitação; recusa persistente; aceitação posterior e revogação.
- axe-core: nenhuma violação automática nas regras WCAG A/AA selecionadas na home em 375/1440 e nas três páginas auxiliares em 375. Isso não equivale a certificação completa de acessibilidade.
- Consulta real somente de leitura à tabela `demo_leads`, selecionando os campos esperados com limite zero: bem-sucedida. Nenhum dado pessoal retornado nem registro alterado.
- Auditoria npm online após atualização: zero vulnerabilidades conhecidas reportadas.
- Sintaxe, geração de `dist`, referências a arquivos públicos, JSON-LD e paridade de cabeçalhos verificadas.

Capturas e relatório de navegador estão em `visual-validation/` (não versionado). Comandos reproduzíveis em [README.md](README.md).

## Limites e operação

1. A validação de Supabase foi somente de leitura. Inserção e entrega ao n8n foram verificadas com simulações para não cadastrar contatos fictícios nem acionar vendas.
2. O limitador é por instância. Rate limiting distribuído, CAPTCHA e fila de retentativas exigem serviços/configuração externos e não foram introduzidos.
3. Não foi adicionada idempotência persistente. O bloqueio de clique e o tratamento de falha secundária reduzem duplicações, mas uma perda de conexão após gravação ainda pode produzir um segundo cadastro.
4. Analytics reais dependem dos IDs no ambiente de build. As configurações do container GTM e a entrega real dos provedores não foram auditadas.
5. Não houve deploy nem alteração de esquema no banco. As migrações existentes foram preservadas. A política de privacidade foi alinhada ao comportamento técnico de cookies, sem alegação de conformidade jurídica certificada.
6. As fontes são servidas pelo Google Fonts, com fontes de sistema como fallback. Medições de conversão e Core Web Vitals de usuários reais dependem da publicação e de tráfego real.

Referências técnicas consultadas: [inserção no Supabase](https://supabase.com/docs/reference/javascript/insert), [Express atrás de proxies](https://expressjs.com/en/guide/behind-proxies/) e os avisos de segurança retornados por `npm audit` ([qs: limite de arrays](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [qs: negação de serviço](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g)). O índice de changelog do Supabase não pôde ser carregado por esta sessão; não foram adotadas APIs novas nem alterações de schema.
