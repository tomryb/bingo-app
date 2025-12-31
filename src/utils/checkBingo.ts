import type { BoardSize } from '../types/bingo'


export function checkBingo(selected: boolean[], size: BoardSize): boolean {
const lines: number[][] = []


for (let r = 0; r < size; r++) {
lines.push([...Array(size)].map((_, i) => r * size + i))
}


for (let c = 0; c < size; c++) {
lines.push([...Array(size)].map((_, i) => i * size + c))
}


lines.push([...Array(size)].map((_, i) => i * size + i))
lines.push([...Array(size)].map((_, i) => i * size + (size - i - 1)))


return lines.some(line => line.every(i => selected[i]))
}