---
name: run
description: Eval spec을 받아 preset 기반 프로토타입을 생성하고 검증합니다. /fde-agent:run <eval-spec-path> [--resume <run-id>]
---

## 실행

사용자가 제공한 eval spec 파일 경로를 받아 Orchestrator를 실행합니다.

1. 인자에서 eval spec 경로와 옵션을 파싱합니다.
2. Bash로 Orchestrator를 실행합니다:

```bash
node <plugin-path>/orchestrator/dist/index.js --spec <eval-spec-path> [--resume <run-id>]
```

3. 실행 결과를 사용자에게 표시합니다.
4. 성공 시 workspace 경로와 리포트 요약을 보여줍니다.
5. escalation 시 사유와 재개 방법을 안내합니다.
