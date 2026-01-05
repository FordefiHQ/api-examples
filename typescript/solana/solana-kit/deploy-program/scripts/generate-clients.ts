import { createFromRoot } from 'codama';
import { rootNodeFromAnchor, AnchorIdl } from '@codama/nodes-from-anchor';
import { renderVisitor as renderJavaScriptVisitor } from "@codama/renderers-js";
import anchorIdl from '../target/idl/solana_deploy_contract_fordefi.json';
import path from 'path';

const codama = createFromRoot(rootNodeFromAnchor(anchorIdl as AnchorIdl));

const jsClient = path.join(__dirname, "..", "clients", "js");
codama.accept(
  renderJavaScriptVisitor(path.join(jsClient, "src", "generated"))
);