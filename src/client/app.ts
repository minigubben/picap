import "./styles.css";

import { bindDashboard } from "./dashboard";
import { bindNetwork } from "./network";
import { startStatusPolling } from "./polling";

bindDashboard(document);
bindNetwork(document);
startStatusPolling();
