import SwiftUI

/// ネイティブサイドバー: Worktree 一覧 + Branch 一覧
///
/// Liquid Glass は NavigationSplitView のサイドバーに自動適用される。
struct SidebarView: View {
    let worktrees: [WorktreeEntry]
    let branches: [String]
    let activeWorktreePath: String
    let onSelectWorktree: (WorktreeEntry) -> Void

    /// main worktree（ROOT セクション用）
    private var rootWorktree: WorktreeEntry? {
        worktrees.first { $0.isMain }
    }

    /// main 以外の worktree（WORKTREES セクション用）
    private var nonRootWorktrees: [WorktreeEntry] {
        worktrees.filter { !$0.isMain }
    }

    var body: some View {
        List {
            // ROOT: メイン worktree
            if let root = rootWorktree {
                Section("ROOT") {
                    WorktreeRow(
                        entry: root,
                        isActive: activeWorktreePath == root.path,
                        onSelect: { onSelectWorktree(root) }
                    )
                }
            }

            // WORKTREES: 作業用 worktree 一覧
            if !nonRootWorktrees.isEmpty {
                Section("WORKTREES") {
                    ForEach(nonRootWorktrees, id: \.path) { entry in
                        WorktreeRow(
                            entry: entry,
                            isActive: activeWorktreePath == entry.path,
                            onSelect: { onSelectWorktree(entry) }
                        )
                    }
                }
            }

            // BRANCHES: worktree 化されていないブランチ
            if !branches.isEmpty {
                Section("BRANCHES") {
                    ForEach(branches, id: \.self) { branch in
                        Label(branch, systemImage: "arrow.triangle.branch")
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

/// Worktree の1行表示
///
/// Task タイトルがあればそれを優先表示し、なければブランチ名を表示する。
private struct WorktreeRow: View {
    let entry: WorktreeEntry
    let isActive: Bool
    let onSelect: () -> Void

    /// Task body の一行目を表示名として使う
    private var displayName: String {
        if let task = entry.task {
            let firstLine = task.body.prefix(while: { $0 != "\n" })
            if !firstLine.isEmpty {
                return String(firstLine)
            }
        }
        return entry.branch ?? "(detached)"
    }

    /// Task に紐づく PR/Issue 番号
    private var issueLabel: String? {
        if let pr = entry.task?.prNumber {
            return "#\(pr)"
        }
        if let issue = entry.task?.issueNumber {
            return "#\(issue)"
        }
        return nil
    }

    var body: some View {
        Button(action: onSelect) {
            HStack {
                if entry.isMain {
                    Image(systemName: "house")
                        .foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(displayName)
                        .lineLimit(2)
                    if let label = issueLabel {
                        Text(label)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(isActive ? Color.accentColor.opacity(0.2) : nil)
    }
}
