# ArkivGate Demo Speech

Tiempo objetivo: 2:40 a 2:55

## Guion

Hola, soy Leo y esto es ArkivGate.

ArkivGate es un security gateway para agentes de AI. Hoy los agentes ya no solo responden texto: llaman herramientas, pagan APIs con x402 y pueden tocar wallets o contratos. Una firma de pago puede ser valida, pero la accion igual puede ser riesgosa.

Por eso ArkivGate pone un paso controlado antes de ejecutar. En la landing se ven los tres servicios principales.

Primero, Prompt Firewall. Revisa lo que el agente quiere mandar al modelo. Si encuentra secretos, credenciales, datos sensibles o instrucciones maliciosas, puede hacer pass, warn, redact o block.

Segundo, x402 Payment Guard. Aca no preguntamos solamente si el agente pago. Preguntamos si la intencion tiene sentido. Si una wallet con 100 dolares intenta mover los 100, el sistema lo bloquea.

Tercero, Wallet Threat Intel. Si el recipient esta reportado o tiene evidencia sospechosa, ArkivGate puede bloquear la ejecucion aunque el monto sea chico.

Ahora voy al playground.

Este prompt tiene una key con formato de secreto. Al ejecutar, el Prompt Firewall lo bloquea antes de que llegue al modelo. El agente puede tener acceso pago, pero no permiso para filtrar credenciales.

Ahora pruebo pagos. Configuro balance 100 y transferencia 100. ArkivGate no valida si el pago existe; evalua si la accion es segura. Como intenta mover todo el balance, da block.

Despues esta el recipient sospechoso. Si tiene threat evidence, la decision final tambien puede ser block, aunque el monto no sea alto. Las tres capas usan el mismo lenguaje: pass, warn, redact y block. La peor severidad gana.

La diferencia clave esta en Arkiv.

Cada decision queda como evidencia estructurada, no como un log interno. ArkivGate escribe entidades como agent, prompt_review, payment_review, threat_report y policy_decision. Todas usan `project=arkivgate-leocagli-2026`, atributos tipados, relaciones y expiraciones distintas.

En el Evidence Browser puedo consultar por tipo de entidad, accion, severidad, risk score, agente y tiempo. Esto demuestra que Arkiv es la capa de datos del producto, no una integracion decorativa.

Ahora paso al admin.

El admin es el cockpit para security y compliance. En dashboard se ve el estado general. En Events esta el feed de auditoria: que paso, que decision se tomo, que policy disparo y cual fue el trace. En Rules se configuran reglas. Suggestions muestra reglas candidatas para aprobacion humana. Analytics muestra riesgo, Team maneja la organizacion, y Arkiv permite revisar setup, smoke tests y entidades.

El cierre es este: x402 prueba que el agente puede pagar. ArkivGate prueba si la accion es segura. Y Arkiv prueba que la decision paso.
