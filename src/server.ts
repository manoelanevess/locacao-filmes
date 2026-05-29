import "dotenv/config";
import express from "express";
import clienteRoutes from "./routes/clienteRoutes.js";
import filmeRoutes from "./routes/filmeRoutes.js";
import locacaoRoutes from "./routes/locacaoRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";

const app = express();
app.use(express.json());

app.use("/clientes", clienteRoutes);
app.use("/filmes", filmeRoutes);
app.use("/locacoes", locacaoRoutes);
app.use("/email", emailRoutes);

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
