# Hermes Skills — Keyframe Character Studio

Bu klasör, projenin Antigravity workflow sisteminin (`.agents/`) Hermes Agent'e taşınmış halidir.
Skill'ler **tek kaynak (source of truth)** olarak bu repoda yaşar; Hermes bunları `skills.external_dirs`
ayarı üzerinden doğrudan tarar. Git'e commit'lenen her değişiklik aynı anda Hermes'te de geçerli olur.

## İçerik

### Kurallar & Bağlam (`.agents/` → `keyframe-studio/`)
| Skill | Kaynak dosya |
|---|---|
| `kcs-constitution` | `.agents/AGENTS.md` |
| `kcs-branch-strategy` | `.agents/BRANCH_STRATEGY.md` |
| `kcs-coding-style` | `.agents/CODING_STYLE.md` |
| `kcs-project-context` | `.agents/PROJECT_CONTEXT.md` |

### Workflow'lar (`.agents/workflows/` → `keyframe-studio/`)
| Skill | Kaynak dosya |
|---|---|
| `kcs-architecture-workflow` | `.agents/workflows/architecture.md` |
| `kcs-bugfix-workflow` | `.agents/workflows/bugfix.md` |
| `kcs-cleanup-workflow` | `.agents/workflows/cleanup.md` |
| `kcs-feature-workflow` | `.agents/workflows/feature.md` |
| `kcs-git-workflow` | `.agents/workflows/git.md` |
| `kcs-performance-workflow` | `.agents/workflows/performance.md` |
| `kcs-refactor-workflow` | `.agents/workflows/refactor.md` |
| `kcs-review-workflow` | `.agents/workflows/review.md` |
| `kcs-testing-workflow` | `.agents/workflows/testing.md` |

## Kurulum (yeni makine / yeni profil)

1. Repoyu clone'la (bu klasörle birlikte gelir).
2. Hermes config'ine dış skill dizinini ekle:

   ```bash
   hermes config set skills.external_dirs 'C:/Users/<user>/.../keyframe-character-studio/skills'
   ```

   - Yol `~` veya `${VAR}` genişletmesi destekler.
   - Değer **çıplak yol** olmalı; JSON köşeli parantezli değer string olarak kaydedilir ve çalışmaz.
   - Dizin yoksa sessizce atlanır (skill'ler kaybolmaz, sadece yüklenmez).

3. Doğrula: `hermes skills list | grep kcs` → 13 skill görünmeli.

## Notlar

- **Yerel öncelik**: Aynı isimde skill hem profil dizininde (`~/.hermes/skills/`) hem burada olursa
  profil kopyası kazanır. Bu repoyu kaynak yapmak için profil kopyalarını silmen gerekir
  (bu repo için yapıldı).
- **skill_manage düzenlemeleri** external dizindeki dosyaya işler → değişiklikler `git diff`'te görünür,
  commit akışı normal git workflow'una bağlıdır (`kcs-git-workflow`).
- Skill index'i oturum başında cache'lendiği için yeni skill'ler **bir sonraki oturumda** görünür.
- `hermes skills inspect <isim>` hub-tarama komutu dış dizinleri çözmez; `hermes skills list` doğru doğrulama aracıdır.
