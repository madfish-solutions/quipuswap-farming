import subprocess
import logging
import shlex
import json


def formatError(err):
    return err.exception.args[-1].strip('\\').strip('\'')


def printDict(val):
    print(json.dumps(val, sort_keys=False, indent=4))


def exec(cmd):
    cmd = shlex.split(cmd)
    process = subprocess.Popen(
        args=cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    stdout, stderr = process.communicate()

    if stderr:
        raise Exception(stderr.decode('utf-8'))
    else:
        return stdout.decode('utf-8')


def get_ligo(is_dockerized_ligo):
    pwd = exec('pwd')[0:-1]
    version = '0.21.0'
    path = 'ligo'

    if is_dockerized_ligo:
        path = f'docker run -v {pwd}:{pwd} --rm -i ligolang/ligo:{version}'

        try:
            exec(f'{path} --help')
        except Exception:
            path = 'ligo'

            exec(f'{path} --help')

    else:
        try:
            exec(f'{path} --help')
        except Exception:
            path = f'docker run -v {pwd}:{pwd} --rm -i ligolang/ligo:{version}'

            exec(f'{path} --help')

    return path


def compile_func(index, func):
    ligo = get_ligo(True)
    pwd = exec('pwd')[0:-1]

    try:
        stdout = exec(
            f'{ligo} compile-parameter --michelson-format=json {pwd}/contracts/main/q_farm.ligo main \'Setup_func(record index={index}n; func={func}; end)\''
        )
    except Exception as err:
        logging.error(err)

        stdout = None

    return stdout
