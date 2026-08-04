// api/produto.js
// Serverless function da Vercel — consulta o código de barras em duas bases:
// 1) Cosmos (Bluesoft) — base brasileira ampla (precisa de token gratuito)
// 2) Open Food Facts — reserva, caso a Cosmos não encontre o produto
//
// O token da Cosmos fica só aqui no servidor (variável de ambiente),
// nunca é exposto no código do navegador.

export default async function handler(req, res) {
  const codigo = (req.query.codigo || "").toString().trim();

  if (!codigo) {
    res.status(400).json({ encontrado: false, erro: "Código de barras não informado." });
    return;
  }

  const token = process.env.COSMOS_TOKEN;

  // 1) Tenta a Cosmos (Bluesoft) primeiro — cobre a maior parte dos produtos do Brasil
  if (token) {
    try {
      const respostaCosmos = await fetch(
        `https://api.cosmos.bluesoft.com.br/products/${encodeURIComponent(codigo)}`,
        {
          headers: {
            "X-Cosmos-Token": token,
            "User-Agent": "SuperDiaExpress/1.0",
          },
        }
      );

      if (respostaCosmos.ok) {
        const dados = await respostaCosmos.json();
        const nome = dados.description || dados.name || "";

        if (nome) {
          res.status(200).json({
            encontrado: true,
            fonte: "cosmos",
            nome,
            marca: dados.brand && dados.brand.name ? dados.brand.name : "",
          });
          return;
        }
      }
    } catch (erro) {
      console.error("Erro ao consultar Cosmos:", erro);
    }
  }

  // 2) Reserva: Open Food Facts (base mundial, focada em alimentos)
  try {
    const respostaOff = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json`
    );
    const dadosOff = await respostaOff.json();

    if (dadosOff && dadosOff.status === 1 && dadosOff.product) {
      const nomeOff =
        dadosOff.product.product_name_pt ||
        dadosOff.product.product_name ||
        dadosOff.product.generic_name_pt ||
        dadosOff.product.generic_name ||
        "";
      const marcaOff = dadosOff.product.brands ? dadosOff.product.brands.split(",")[0].trim() : "";
      const quantidadeOff = (dadosOff.product.quantity || "").trim();

      if (nomeOff) {
        res.status(200).json({
          encontrado: true,
          fonte: "openfoodfacts",
          nome: nomeOff,
          marca: marcaOff,
          quantidade: quantidadeOff,
        });
        return;
      }
    }
  } catch (erro) {
    console.error("Erro ao consultar Open Food Facts:", erro);
  }

  res.status(200).json({ encontrado: false });
}