---
name: run
description: Eval spec을 받아 preset 기반 프로토타입을 생성하고 검증합니다. /fde-agent:run --spec <eval-spec-path> [--resume <run-id>]
---

## 실행

사용자가 제공한 인자를 그대로 전달하여 Orchestrator를 실행합니다.

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/run/scripts/run.sh" --spec <eval-spec-path> [--resume <run-id>]
```

실행 결과를 사용자에게 표시합니다:
- 성공 시 workspace 경로와 리포트 요약을 보여줍니다.
- escalation 시 사유와 재개 방법을 안내합니다.
