# Hermes Skills — Keyframe Character Studio

Bu klasör, projenin Antigravity workflow sisteminin (`.agents/`) Hermes Agent'e taşınmış halidir.
Skill'ler **tek kaynak (source of truth)** olarak bu repoda yaşar; Hermes bunları `skills.external_dirs`
ayarı üzerinden doğrudan tarar. Git'e commit'lenen her değişiklik aynı anda Hermes'te de geçerli olur.

## İçerik

### Kurallar & Bağlam (`.agents/` → `keyframe-studio/`)
| Skill | Kaynak dosya |
|---|---|
| `kcs-constitution` | `.agents/AGENTS.md` |
| `kcs-coding-style` | `.agents/CODING_STYLE.md` |
| `kcs-project-context` | `.agents/PROJECT_CONTEXT.md` |

### Workflow'lar (`.agents/workflows/` → `keyframe-studio/`)
| Skill | Kaynak dosya |
|---|---|
| `kcs-git-workflow` | `.agents/workflows/git.md` + `.agents/BRANCH_STRATEGY.md` (birleşik) |
| `kcs-workflows` | `.agents/workflows/` → architecture, feature, bugfix, refactor, cleanup, performance, review, testing (birleşik, bölüm bazlı dağıtım) |

## Kurulum (yeni makine / yeni profil)

1. Repoyu clone'la (bu klasörle birlikte gelir).
2. Hermes config'ine dış skill dizinini ekle:

   ```bash
   hermes config set skills.external_dirs 'C:/Users/<user>/.../keyframe-character-studio/skills'
   ```

   - Yol `~` veya `${VAR}` genişletmesi destekler.
   - Değer **çıplak yol** olmalı; JSON köşeli parantezli değer string olarak kaydedilir ve çalışmaz.
   - Dizin yoksa sessizce atlanır (skill'ler kaybolmaz, sadece yüklenmez).

3. Doğrula: `hermes skills list | grep kcs` → 5 skill görünmeli.

## Notlar

- **Yerel öncelik**: Aynı isimde skill hem profil dizininde (`~/.hermes/skills/`) hem burada olursa
  profil kopyası kazanır. Bu repoyu kaynak yapmak için profil kopyalarını silmen gerekir
  (bu repo için yapıldı).
- **skill_manage düzenlemeleri** external dizindeki dosyaya işler → değişiklikler `git diff`'te görünür,
  commit akışı normal git workflow'una bağlıdır (`kcs-git-workflow`).
- Skill index'i oturum başında cache'lendiği için yeni skill'ler **bir sonraki oturumda** görünür.
- `hermes skills inspect <isim>` hub-tarama komutu dış dizinleri çözmez; `hermes skills list` doğru doğrulama aracıdır.
