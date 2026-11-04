"""Generate the direct cart entry from the shared local portal shell."""
from pathlib import Path

root = Path(__file__).resolve().parent
source = (root / 'home.html').read_text(encoding='utf-8')
source = source.replace('<title>Portal da Sorte | Modalidades</title>', '<title>Carrinho de Apostas | Portal da Sorte</title>')
source = source.replace('<head>', '<head>\n  <script>if (!location.hash) history.replaceState(null, "", "#carrinho");</script>', 1)
(root / 'carrinho.html').write_text(source, encoding='utf-8')
