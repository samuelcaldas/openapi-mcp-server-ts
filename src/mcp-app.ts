import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "OpenAPI App", version: "1.0.0" });

app.ontoolinput = (params) => {
  document.getElementById("output")!.textContent = `Waiting for result...`;
};

app.ontoolresult = (result) => {
  document.getElementById("output")!.textContent = JSON.stringify(result, null, 2);
};

app.connect();
