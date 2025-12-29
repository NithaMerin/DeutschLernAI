import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Level } from '../../models/types';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  levelSelected = output<Level>();

  levels: Level[] = [
    { id: 'A1', title: 'Anfänger', description: 'Beginner level, basic phrases and personal introductions.', color: 'from-green-500 to-emerald-500' },
    { id: 'A2', title: 'Grundlagen', description: 'Elementary, simple sentences on familiar topics.', color: 'from-sky-500 to-cyan-500' },
    { id: 'B1', title: 'Mittelstufe', description: 'Intermediate, understand main points on familiar matters.', color: 'from-yellow-500 to-amber-500' },
    { id: 'B2', title: 'Gute Mittelstufe', description: 'Upper Intermediate, understand complex texts.', color: 'from-orange-500 to-red-500' },
    { id: 'C1', title: 'Fortgeschritten', description: 'Advanced, express ideas fluently and spontaneously.', color: 'from-red-600 to-rose-600' },
    { id: 'C2', title: 'Experte', description: 'Proficient, understand with ease virtually everything.', color: 'from-purple-600 to-violet-600' },
  ];

  selectLevel(level: Level) {
    this.levelSelected.emit(level);
  }
}