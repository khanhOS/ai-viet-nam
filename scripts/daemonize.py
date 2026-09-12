#!/usr/bin/env python3
"""Daemon hoá một lệnh: double-fork + setsid → thoát hoàn toàn process group
của shell cha (sandbox reaper không giết được). Dùng: daemonize.py <logfile> <cmd> [args...]"""
import os, sys, shutil

def main():
    if len(sys.argv) < 3:
        sys.exit("usage: daemonize.py <logfile> <cmd> [args...]")
    logfile, cmd, args = sys.argv[1], sys.argv[2], sys.argv[3:]
    # fork lần 1
    pid = os.fork()
    if pid > 0:
        os._exit(0)
    os.setsid()
    # fork lần 2 (orphan → reparent về init/tini)
    pid = os.fork()
    if pid > 0:
        os._exit(0)
    # đóng stdio, ghi log
    os.umask(0)
    os.chdir("/")
    fd = os.open(logfile, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.dup2(fd, 1)
    os.dup2(fd, 2)
    devnull = os.open(os.devnull, os.O_RDONLY)
    os.dup2(devnull, 0)
    resolved = shutil.which(cmd) or cmd
    env = dict(os.environ)
    os.execve(resolved, [cmd] + args, env)

if __name__ == "__main__":
    main()
