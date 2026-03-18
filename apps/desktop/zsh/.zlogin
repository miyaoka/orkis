# orkis zsh wrapper — ユーザーの .zlogin を透過的に読み込む

_orkis_user_zdotdir="${ORKIS_USER_ZDOTDIR:-${ORKIS_ORIG_ZDOTDIR:-$HOME}}"
export ZDOTDIR="$_orkis_user_zdotdir"
[[ -f "$_orkis_user_zdotdir/.zlogin" ]] && source "$_orkis_user_zdotdir/.zlogin"
export ZDOTDIR="$ORKIS_ZDOTDIR"
